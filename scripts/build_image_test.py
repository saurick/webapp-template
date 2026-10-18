import base64
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("build_image", Path(__file__).with_name("build-image.py"))
build_image = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_image)

AUTH_EOF = ('failed to authorize: failed to fetch anonymous token: Get '
            '"https://auth.docker.io/token?scope=repository%3Alibrary%2Falpine%3Apull&service=registry.docker.io": EOF')
METADATA = "[internal] load metadata for docker.io/library/alpine:3.21"
FROM = "[web-builder 1/15] FROM docker.io/library/node:24.21.0@sha256:fixture"


def vertex(name=METADATA, error=AUTH_EOF, digest="sha256:fixture"):
    return {"vertexes": [{"digest": digest, "name": name, "error": error}]}


class RetryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="image-retry-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.logs = self.root / "logs"
        self.calls = self.root / "calls.jsonl"
        self.scenarios = self.root / "scenarios.json"
        docker = self.bin / "docker"
        docker.write_text(f'''#!{sys.executable}
import json,os,sys,time
from pathlib import Path
calls=Path(os.environ['RETRY_TEST_CALLS'])
count=len(calls.read_text().splitlines()) if calls.exists() else 0
with calls.open('a') as f:f.write(json.dumps(sys.argv[1:])+'\\n')
rows=json.loads(Path(os.environ['RETRY_TEST_SCENARIOS']).read_text())
case=rows[min(count,len(rows)-1)]
if case.get('wait'):
 Path(os.environ['RETRY_TEST_PID']).write_text(str(os.getpid()))
 time.sleep(60)
for event in case.get('events',[]):print(json.dumps(event),file=sys.stderr,flush=True)
print(case.get('text',''),file=sys.stderr,flush=True)
sys.exit(case['exit'])
''')
        docker.chmod(0o755)
        self.env = {**os.environ, "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
                    "IMAGE_BUILD_LOG_ROOT": str(self.logs), "RETRY_TEST_CALLS": str(self.calls),
                    "RETRY_TEST_SCENARIOS": str(self.scenarios), "RETRY_TEST_PID": str(self.root / "pid")}

    def failure(self, name=METADATA, error=AUTH_EOF):
        return {"exit": 42, "events": [vertex(name, error)], "text": "ERROR: failed to build: failed to solve: " + error}

    def execute(self, scenarios):
        self.scenarios.write_text(json.dumps(scenarios))
        with patch.dict(os.environ, self.env), patch.object(build_image.time, "sleep") as sleep:
            result = build_image.build(["--load", "--platform", "linux/amd64", "."])
        receipt = json.loads(next(self.logs.glob("*/result.json")).read_text())
        calls = [json.loads(line) for line in self.calls.read_text().splitlines()]
        return result, receipt, calls, sleep

    def test_auth_eof_recovers_and_preserves_identical_arguments(self):
        code, receipt, calls, sleep = self.execute([self.failure(), {"exit": 0}])
        self.assertEqual(code, 0)
        self.assertEqual(receipt["status"], "success")
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0], calls[1])
        self.assertEqual(calls[0][:3], ["buildx", "build", "--progress=rawjson"])
        self.assertEqual(sleep.call_args_list[0].args, (3,))
        self.assertIn("EOF", next(self.logs.glob("*/attempt-1.log")).read_text())

    def test_permanent_network_failure_is_bounded_and_remains_failed(self):
        code, receipt, calls, sleep = self.execute([self.failure()])
        self.assertEqual(code, 42)
        self.assertEqual(receipt["status"], "failed")
        self.assertEqual(len(calls), 3)
        self.assertEqual([c.args for c in sleep.call_args_list], [(3,), (10,)])
        self.assertFalse(receipt["attempts"][-1]["retry"])

    def test_two_transient_failures_then_success(self):
        code, receipt, calls, _ = self.execute([self.failure(), self.failure(FROM, "failed to copy: unexpected EOF"), {"exit": 0}])
        self.assertEqual((code, len(calls)), (0, 3))
        self.assertEqual(receipt["attempts"][-1]["exit_code"], 0)

    def test_compile_run_dependency_and_unknown_errors_fail_once(self):
        cases = [("[builder 8/8] RUN go build ./...", AUTH_EOF),
                 ("[web-builder 4/15] RUN pnpm install", "connection reset by peer"),
                 ("[internal] load build definition from Dockerfile", "unexpected EOF"),
                 ("[internal] load metadata for registry.example.com/app:1", "EOF"),
                 (METADATA, "manifest unknown"), (METADATA, "failed to read: no space left on device"),
                 (METADATA, "unexpected EOF: checksum mismatch"),
                 (METADATA, "unexpected status 403 Forbidden: EOF"),
                 (METADATA, "429 Too Many Requests: EOF"),
                 (METADATA, "x509: certificate has expired: EOF")]
        for index, (name, error) in enumerate(cases):
            with self.subTest(name=name, error=error):
                self.logs = self.root / f"logs-{index}"
                self.env["IMAGE_BUILD_LOG_ROOT"] = str(self.logs)
                self.calls.unlink(missing_ok=True)
                code, _, calls, sleep = self.execute([self.failure(name, error)])
                self.assertEqual(code, 42)
                self.assertEqual(len(calls), 1)
                sleep.assert_not_called()

    def test_eof_in_build_log_cannot_forge_retryable_vertex(self):
        case = self.failure("[builder 8/8] RUN go build ./...", "process did not complete successfully: exit code 1")
        fake = json.dumps(vertex()) + "\nERROR: failed to build: " + AUTH_EOF
        case["events"].append({"logs": [{"vertex": "sha256:run", "data": base64.b64encode(fake.encode()).decode()}]})
        code, _, calls, _ = self.execute([case])
        self.assertEqual((code, len(calls)), (42, 1))

    def test_mixed_parallel_failures_do_not_hide_real_build_failure(self):
        case = self.failure()
        case["events"].append(vertex("[builder 8/8] RUN go build ./...", "compile error", "sha256:run"))
        code, _, calls, _ = self.execute([case])
        self.assertEqual((code, len(calls)), (42, 1))

    def test_unstructured_eof_and_malformed_events_fail_closed(self):
        for index, case in enumerate([
            {"exit": 42, "text": "ERROR: " + AUTH_EOF},
            {**self.failure(), "events": [vertex(), {"vertexes": "invalid"}]},
            {**self.failure(), "events": [vertex(), {"logs": "invalid"}]},
            {**self.failure(), "text": "ERROR: unknown client failure"},
        ]):
            with self.subTest(index=index):
                self.logs = self.root / f"invalid-{index}"
                self.env["IMAGE_BUILD_LOG_ROOT"] = str(self.logs)
                self.calls.unlink(missing_ok=True)
                code, _, calls, _ = self.execute([case])
                self.assertEqual((code, len(calls)), (42, 1))

    def test_reset_timeout_and_cancelled_sibling_during_pull(self):
        for error in ("failed to do request: connection reset by peer", "i/o timeout", "TLS handshake timeout", "unexpected EOF"):
            status = build_image.BuildStatus()
            status.consume(vertex(FROM, error))
            status.consume(vertex("[builder 8/8] RUN go build", "context canceled", "sha256:sibling"))
            status.final_error = "ERROR: " + error
            self.assertTrue(status.retryable())

    def test_success_is_not_repeated_even_with_eof_warning(self):
        code, receipt, calls, sleep = self.execute([{"exit": 0, "events": [vertex()], "text": "ERROR: " + AUTH_EOF}])
        self.assertEqual((code, len(calls), receipt["status"]), (0, 1, "success"))
        sleep.assert_not_called()

    def test_logs_redact_proxy_and_url_credentials(self):
        self.env["HTTPS_PROXY"] = "http://fixture-user:fixture-password@proxy.invalid:3128"
        case = self.failure()
        case["text"] += '\nproxy=' + self.env["HTTPS_PROXY"] + '\nhttps://fixture-user:fixture-password@registry.invalid/path'
        self.execute([case])
        logs = "".join(p.read_text() for p in self.logs.glob("*/*.log"))
        self.assertNotIn("fixture-password", logs)
        self.assertIn("[PROXY]", logs)

    def test_sigterm_stops_child_without_retry(self):
        self.scenarios.write_text(json.dumps([{"exit": 42, "wait": True}]))
        child = subprocess.Popen([sys.executable, "-B", str(Path(__file__).with_name("build-image.py")), "--", "--load", "."],
                                 env=self.env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        try:
            deadline = time.monotonic() + 5
            while not (self.root / "pid").exists() and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertTrue((self.root / "pid").exists())
            docker_pid = int((self.root / "pid").read_text())
            child.send_signal(signal.SIGTERM)
            output, _ = child.communicate(timeout=7)
            self.assertEqual(child.returncode, 130, output)
            with self.assertRaises(ProcessLookupError):
                os.kill(docker_pid, 0)
            self.assertEqual(len(self.calls.read_text().splitlines()), 1)
            receipt = json.loads(next(self.logs.glob("*/result.json")).read_text())
            self.assertEqual(receipt["status"], "interrupted")
        finally:
            if child.poll() is None:
                child.kill()
            child.communicate()


if __name__ == "__main__":
    unittest.main()
