"""测试真实初始化编排；网络和 systemd 由受控边界替代。"""

import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import tomllib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("setup_runner", Path(__file__).with_name("setup-runner.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
RealAPI = module.API


class FakeAPI:
    def __init__(self):
        self.project = {"id": 42, "path_with_namespace": "team/demo", "default_branch": "master", "archived": False}
        self.runners = []
        self.protection = None
        self.creates = 0
        self.active_jobs = []

    def call(self, method, path, data=None, missing_ok=False):
        if path == "/projects/team%2Fdemo":
            return copy.deepcopy(self.project)
        if "protected_branches" in path:
            if method == "POST":
                self.protection = {"allow_force_push": False, "name": data["name"]}
            return copy.deepcopy(self.protection)
        if path == "/user/runners":
            self.creates += 1
            self.runners.append({**data, "id": 9, "projects": [{"id": 42}], "status": "online"})
            return {"id": 9, "token": "fixture-auth-value"}
        if path == "/runners/9":
            if method == "PUT":
                self.runners[0].update(data)
            return copy.deepcopy(self.runners[0])
        raise AssertionError((method, path))

    def items(self, path):
        return copy.deepcopy(self.active_jobs if "/jobs?" in path else self.runners)


class SetupRunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="runner-init-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = {"gitlab_url": "https://gitlab.example.com", "api_token_file": str(self.root / "token"),
                       "environment": {}, "extra_hosts": []}
        self.api = FakeAPI()
        self.commands = []
        self.patches = [patch.object(module, "STATE_ROOT", self.root / "etc"),
                        patch.object(module, "WORK_ROOT", self.root / "work"),
                        patch.object(module, "UNIT_ROOT", self.root / "units"),
                        patch.object(module, "APPARMOR_RESTRICTION", self.root / "restriction"),
                        patch.object(module, "APPARMOR_PROFILE", self.root / "profile"),
                        patch.object(module, "API", return_value=self.api),
                        patch.object(module, "run", side_effect=self.command),
                        patch.object(module.shutil, "which", return_value="/usr/bin/gitlab-runner")]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)
        (self.root / "units").mkdir()

    def command(self, args):
        self.commands.append(args)
        return "active"

    def config_file(self):
        file = self.root / "host.json"
        file.write_text(json.dumps(self.config))
        file.chmod(0o600)
        return file

    def apply(self, mode="apply"):
        return module.setup(self.config, "team/demo", mode)

    def test_first_run_reuses_runner_and_does_not_restart_on_repeat(self):
        first = self.apply()
        self.assertTrue(first["protected"])
        self.assertEqual(self.api.creates, 1)
        config = next((self.root / "etc").glob("*/config.toml"))
        private = tomllib.loads(config.read_text())["runners"][0]
        self.assertEqual(config.stat().st_mode & 0o777, 0o600)
        self.assertFalse(private["docker"]["privileged"])
        self.assertTrue(private["docker"]["services_privileged"])
        self.assertNotIn("/var/run/docker.sock", private["docker"]["volumes"])
        self.commands.clear()
        second = self.apply()
        self.assertFalse(second["changed"])
        self.assertEqual(self.api.creates, 1)
        self.assertFalse(any("restart" in c for c in self.commands))
        self.assertNotIn("fixture-auth-value", json.dumps(second))
        self.assertEqual(self.apply("check")["runner_id"], 9)

    def test_partial_host_failure_resumes_without_duplicate_runner(self):
        with patch.object(module, "run", side_effect=module.SetupError("host unavailable")):
            with self.assertRaises(module.SetupError):
                self.apply()
        self.assertEqual(self.api.creates, 1)
        self.assertEqual(self.apply()["status"], "online")
        self.assertEqual(self.api.creates, 1)

    def test_foreign_project_and_permission_drift_stop_before_host_change(self):
        self.apply()
        self.api.runners[0]["projects"] = [{"id": 99}]
        self.commands.clear()
        with self.assertRaisesRegex(module.SetupError, "归属"):
            self.apply()
        self.assertEqual(self.commands, [])
        self.api.runners[0]["projects"] = [{"id": 42}]
        self.api.runners[0]["locked"] = False
        with self.assertRaisesRegex(module.SetupError, "权限"):
            self.apply()

    def test_existing_force_push_permission_is_not_silently_changed(self):
        self.api.protection = {"allow_force_push": True}
        with self.assertRaisesRegex(module.SetupError, "强推"):
            self.apply()
        self.assertTrue(self.api.protection["allow_force_push"])
        self.assertTrue(self.api.runners[0]["paused"])

    def test_changed_config_pauses_before_refusing_active_jobs(self):
        self.apply()
        self.config["environment"]["GOPROXY"] = "https://proxy.example.com,direct"
        self.api.active_jobs = [{"id": 123}]
        self.commands.clear()
        with self.assertRaisesRegex(module.SetupError, "活动 job"):
            self.apply()
        self.assertTrue(self.api.runners[0]["paused"])
        self.assertEqual(self.commands, [])

    def test_pause_preserves_config_and_stops_only_own_service(self):
        first = self.apply()
        result = self.apply("pause")
        self.assertTrue(self.api.runners[0]["paused"])
        self.assertEqual(self.commands[-1], ["systemctl", "disable", "--now", first["service"]])
        self.assertTrue(result["config_retained"])
        self.assertEqual(len(list((self.root / "etc").glob("*/config.toml"))), 1)

    def test_unowned_directory_is_not_overwritten(self):
        module.STATE_ROOT.mkdir(mode=0o700)
        import hashlib
        key = hashlib.sha256(self.config["gitlab_url"].encode()).hexdigest()[:10] + "-42"
        directory = module.STATE_ROOT / key
        directory.mkdir()
        with self.assertRaisesRegex(module.SetupError, "拒绝覆盖"):
            self.apply()
        self.assertEqual(self.api.creates, 0)

    def test_lock_prevents_concurrent_initialization(self):
        first = self.apply()
        lock_path = next((self.root / "etc").glob("*.lock"))
        with lock_path.open("a") as lock:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(module.SetupError, "正在初始化"):
                self.apply()
        self.assertEqual(first["runner_id"], self.apply()["runner_id"])

    def test_unknown_creation_outcome_does_not_create_duplicate(self):
        first = self.apply()
        next((self.root / "etc").glob("*/state.json")).write_text(json.dumps({k: v for k, v in first.items()
            if k in ("schema", "gitlab_url", "project_id", "project_path", "service")}))
        with self.assertRaisesRegex(module.SetupError, "同名远端"):
            self.apply()
        self.assertEqual(self.api.creates, 1)

    def test_config_denies_secret_environment_and_adds_dind_bypass(self):
        self.config["environment"] = {"HTTPS_PROXY": "http://proxy.example.com:3128"}
        config = module.load_config(self.config_file())
        self.assertIn("docker", config["environment"]["NO_PROXY"].split(","))
        self.config["environment"]["GITLAB_API_TOKEN"] = "fixture-private-value"
        with self.assertRaisesRegex(module.SetupError, "禁止注入"):
            module.load_config(self.config_file())

    def test_private_files_reject_world_readable_and_symlink(self):
        file = self.config_file()
        file.chmod(0o644)
        with self.assertRaises(module.SetupError):
            module.load_config(file)
        file.chmod(0o600)
        link = self.root / "linked.json"
        link.symlink_to(file)
        with self.assertRaises(module.SetupError):
            module.load_config(link)

    def test_api_errors_and_redirects_do_not_expose_secrets(self):
        self.config_file()
        (self.root / "token").write_text("fixture-api-value")
        (self.root / "token").chmod(0o600)
        real_api = RealAPI(self.config)
        from urllib.error import HTTPError
        response = HTTPError("https://private/", 403, "fixture-api-value", {}, io.BytesIO(b"fixture-api-value"))
        self.addCleanup(response.close)
        with patch.object(real_api.client, "open", side_effect=response):
            with self.assertRaises(module.SetupError) as result:
                real_api.call("POST", "/user/runners", {"token": "fixture-api-value"})
        self.assertNotIn("fixture-api-value", str(result.exception))
        with self.assertRaisesRegex(module.SetupError, "重定向"):
            module.NoRedirect().redirect_request(None, None, 302, "", {}, "https://foreign.example.com")


if __name__ == "__main__":
    unittest.main()
