#!/usr/bin/env python3
"""创建私有 GitLab 工程骨架、初始化、接入专属 Runner 并验收首轮 CI。"""

import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.parse import quote
import uuid

ROOT = Path(__file__).resolve().parents[1]
JOURNALS = Path("/etc/gitlab-project-bootstrap")
REQUIRED_JOBS = {"validate_template", "initialize_project", "package_template", "package_derived"}
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("runner_setup", ROOT / "scripts/ci/setup-runner.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
require = runner.require


def environment():
    env = os.environ.copy()
    for key in list(env):
        if key.startswith("GIT_"):
            env.pop(key)
    env.update(GIT_OPTIONAL_LOCKS="0", GIT_TERMINAL_PROMPT="0")
    return env


def command(args, cwd, env=None, timeout=120, log=None, error_log=None):
    with (log.open("w") if log else open(os.devnull, "w")) as output:
        result = subprocess.run(args, cwd=cwd, env=env or environment(), capture_output=log is None,
                                stdout=output if log else None, stderr=subprocess.STDOUT if log else None,
                                text=True, timeout=timeout, check=False)
    if result.returncode and error_log:
        details = (result.stdout or "") + (result.stderr or "")
        token_file = (env or {}).get("BOOTSTRAP_TOKEN_FILE")
        if token_file:
            details = details.replace(runner.private_read(token_file).strip(), "[REDACTED]")
        details = re.sub(r"(https?://)[^\s/@]+@", r"\1[REDACTED]@", details)
        runner.atomic_write(error_log, details)
    require(result.returncode == 0, f"{Path(args[0]).name} 执行失败；请查本次初始化日志，修复后重跑同一命令")
    return result.stdout.strip() if log is None else ""


def git(args, directory, env=None):
    return command(["git", *args], directory, env)


def require_clean(directory, sha):
    require(git(["rev-parse", "HEAD"], directory) == sha
            and not git(["status", "--porcelain=v1", "--untracked-files=all"], directory),
            "初始化源码已有修改或 HEAD 漂移，保留现场并停止")


def source_checkpoint(target):
    files = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"], target).split("\0")
    fingerprints = {}
    for name in set(files) - {""}:
        path = target / name
        require(path.is_file() and not path.is_symlink(), "初始化目录存在不支持的文件类型")
        fingerprints[name] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                              "mode": path.stat().st_mode & 0o777}
    return {"files": fingerprints, "index": git(["ls-files", "--stage"], target)}


def auth_env(config, journal):
    # 凭据仅由 askpass 子进程读取；URL、命令参数、Git 配置和 CI 环境均不携带 token。
    askpass = journal / "git-askpass.py"
    runner.atomic_write(askpass, "#!/usr/bin/env python3\nimport os,sys\nfrom pathlib import Path\n"
                        "print('oauth2' if 'username' in sys.argv[1].lower() else Path(os.environ['BOOTSTRAP_TOKEN_FILE']).read_text().strip())\n", 0o700)
    return {**environment(), "GIT_ASKPASS": str(askpass), "BOOTSTRAP_TOKEN_FILE": config["api_token_file"],
            "BOOTSTRAP_LOG_DIR": str(journal)}


def remote_git(args, directory, env):
    return command(["git", "-c", "credential.helper=", "-c", "http.followRedirects=false", "-c", "http.proxy=",
                    "-c", "http.sslVerify=true", *args], directory, env,
                   error_log=Path(env["BOOTSTRAP_LOG_DIR"]) / "git-error.log")


def prepare_source(source, sha, target, project_id, name, creation_id, journal):
    checkpoint = journal / "source-checkpoint.json"
    def save_checkpoint():
        runner.atomic_write(checkpoint, json.dumps(source_checkpoint(target)) + "\n")
    if target.exists():
        marker = json.loads((target / ".project-bootstrap.json").read_text())
        require(marker["creation_id"] == creation_id and marker["template_sha"] == sha,
                "目标目录不属于本次初始化")
        require(checkpoint.exists() and json.loads(runner.private_read(checkpoint)) == source_checkpoint(target),
                "未完成初始化的源码或 index 已变化，保留现场，拒绝自动暂存")
        head = subprocess.run(["git", "rev-parse", "--verify", "HEAD"], cwd=target,
                              env=environment(), capture_output=True, text=True)
        if head.returncode == 0:
            require(git(["rev-list", "--count", "HEAD"], target) == "1", "目标仓库已有后续提交，停止初始化")
            require_clean(target, head.stdout.strip())
            return head.stdout.strip()
    else:
        with tempfile.TemporaryDirectory(prefix="source-", dir=journal) as temporary:
            archive = Path(temporary) / "source.tar"
            git(["archive", "--output", str(archive), sha], source)
            target.mkdir(mode=0o700)
            runner.atomic_write(target / ".project-bootstrap.json", json.dumps({
                "creation_id": creation_id, "template_sha": sha, "phase": "preparing"
            }) + "\n", 0o644)
            with tarfile.open(archive) as package:
                for member in package.getmembers():
                    require(not member.name.startswith("/") and ".." not in Path(member.name).parts
                            and not member.issym() and not member.islnk(), "模板归档存在不支持的路径")
                package.extractall(target, filter="data")
            git(["init", "--quiet", "-b", "main"], target)
            save_checkpoint()
    node = command(["node", "--version"], source).removeprefix("v")
    require(node == (target / ".n-node-version").read_text().strip(), "Node 版本必须匹配模板 .n-node-version")
    command(["bash", "scripts/init-project.sh"], target, log=journal / "init-before.log")
    command(["node", str(source / "scripts/project-scaffold.mjs"), str(target), project_id,
             name, sha, creation_id], source, log=journal / "configure.log")
    save_checkpoint()
    command(["bash", "scripts/init-project.sh", "--project", "--strict"], target, log=journal / "init-strict.log")
    git(["add", "."], target)
    save_checkpoint()
    git(["-c", "user.name=Project Bootstrap", "-c", "user.email=project-bootstrap@example.invalid",
         "commit", "--quiet", "-m", "chore(init): 初始化项目工程基线"], target)
    initial_sha = git(["rev-parse", "HEAD"], target)
    require_clean(target, initial_sha)
    return initial_sha


def project_ok(project, path, creation_id, project_id=None):
    require(project["path_with_namespace"] == path and project["visibility"] == "private"
            and not project["archived"] and (project_id is None or project["id"] == project_id)
            and project.get("description") == "Project bootstrap: " + creation_id,
            "远端同名项目不属于本次初始化或权限漂移，拒绝接管")
    require(project.get("shared_runners_enabled") is False and project.get("group_runners_enabled") is False,
            "项目仍启用共享或组 Runner，停止接入")


def wait_pipeline(api, project_id, sha, runner_id, state, save, timeout):
    prefix = f"/projects/{project_id}"
    deadline = time.monotonic() + timeout
    previous = None
    while True:
        pipelines = api.call("GET", prefix + "/pipelines?" + f"sha={sha}&ref=main&source=push&sort=asc&per_page=100")
        if pipelines:
            chosen = state.get("pipeline_id", pipelines[0]["id"])
            require(any(p["id"] == chosen for p in pipelines), "已绑定的首轮流水线不可见，停止")
            state["pipeline_id"] = chosen
            pipeline = api.call("GET", prefix + f"/pipelines/{chosen}")
            require(pipeline["sha"] == sha and pipeline["ref"] == "main", "流水线输入 SHA 或分支不符")
            jobs = api.items(prefix + f"/pipelines/{chosen}/jobs?include_retried=false")
            state["pipeline_url"] = pipeline["web_url"]
            state["pipeline_status"] = pipeline["status"]
            state["jobs"] = [{"id": j["id"], "name": j["name"], "status": j["status"],
                              "runner_id": (j.get("runner") or {}).get("id"), "web_url": j["web_url"]} for j in jobs]
            save()
            signature = (pipeline["status"], tuple((j["id"], j["status"]) for j in jobs))
            if signature != previous:
                print(json.dumps({"pipeline_url": pipeline["web_url"], "status": pipeline["status"],
                                  "jobs": [{"name": j["name"], "status": j["status"]} for j in jobs]}, ensure_ascii=False), flush=True)
                previous = signature
            require(pipeline["status"] not in ("failed", "canceled", "skipped", "manual"),
                    "首轮流水线未通过；保留项目、Runner 和日志，不自动重试真实失败")
            if pipeline["status"] == "success":
                require({j["name"] for j in jobs} == REQUIRED_JOBS and len(jobs) == 4
                        and all(j["status"] == "success" and not j["allow_failure"]
                                and (j.get("runner") or {}).get("id") == runner_id for j in jobs),
                        "四个必要 job 或 Runner 绑定未通过")
                return jobs
        require(time.monotonic() < deadline, "等待 CI 超时；远端任务继续运行，可重跑同一命令读取结果")
        time.sleep(15)


def artifact_evidence(api, project_id, sha, pipeline_id, jobs):
    by_name = {j["name"]: j for j in jobs}
    def read(job_name, filename):
        job = by_name[job_name]
        require(job.get("artifacts_file", {}).get("size", 0) > 0, "CI 制品缺失")
        return api.call("GET", f"/projects/{project_id}/jobs/{job['id']}/artifacts/output/ci/{filename}")
    initialized = read("initialize_project", "derived.json")
    require(initialized["source_sha"] == sha and initialized["pipeline_id"] == str(pipeline_id)
            and initialized["init"] == initialized["strict"] == "passed" and initialized["fixture_only"],
            "派生源码制品回读失败")
    images = []
    for variant in ("template", "derived"):
        data = read("package_" + variant, "images/" + variant + ".json")
        require(data["pipeline_sha"] == sha and data["pipeline_id"] == str(pipeline_id)
                and data["source_sha"] == (sha if variant == "template" else initialized["derived_sha"])
                and data["variant"] == variant and data["load"] == data["binary_and_web"] == "passed"
                and data["proxy_absent"] and data["platform"] == "linux/amd64"
                and re.fullmatch(r"[0-9a-f]{64}", data["sha256"])
                and re.fullmatch(r"sha256:[0-9a-f]{64}", data["config_digest"]), "镜像制品元数据回读失败")
        images.append(data)
    return {"initialized": initialized, "images": images}


def create(config, path, name, destination, timeout=3600):
    require(re.fullmatch(r"[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+", path), "项目路径必须为 namespace/project")
    namespace, project_id = path.rsplit("/", 1)
    require(re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", project_id) and len(project_id) <= 48
            and project_id != "webapp-template", "项目标识须为不超过 48 字符的小写字母、数字和连字符")
    require(isinstance(name, str) and 1 <= len(name.strip()) <= 40 and not re.search(r"[\x00-\x1f\x7f<>`$]", name), "项目名称格式不符")
    target = Path(destination).absolute()
    require(target.parent.is_dir() and target.parent.resolve() == target.parent and not target.is_symlink()
            and not target.is_relative_to(ROOT) and not ROOT.is_relative_to(target), "目标须在模板目录之外，父目录须存在且不能经过符号链接")
    sha = git(["rev-parse", "HEAD"], ROOT)
    require_clean(ROOT, sha)
    require(re.search(r"^DEV_PROJECT_ID=webapp-template$", (ROOT / "config/dev-ports.env").read_text(), re.M),
            "创建入口须从干净的模板源仓库执行，不能把已初始化项目当作模板")
    runner.ensure_directory(JOURNALS)
    key = hashlib.sha256((config["gitlab_url"] + "/" + path).encode()).hexdigest()[:24]
    journal = JOURNALS / key
    runner.ensure_directory(journal)
    require(not (journal / "lock").is_symlink(), "拒绝符号链接锁")
    with open(journal / "lock", "a", opener=lambda p, flags: os.open(p, flags, 0o600)) as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise runner.SetupError("该项目正在初始化") from None
        state_path = journal / "state.json"
        expected = {"schema": 1, "gitlab_url": config["gitlab_url"], "project_path": path,
                    "project_name": name.strip(), "destination": str(target), "template_sha": sha}
        if state_path.exists():
            state = json.loads(runner.private_read(state_path))
            require(all(state.get(k) == v for k, v in expected.items()), "初始化参数或模板版本已变化，拒绝复用旧状态")
        else:
            require(not target.exists(), "目标目录已存在，拒绝覆盖")
            state = {**expected, "creation_id": str(uuid.uuid4()), "phase": "starting"}
        def save():
            runner.atomic_write(state_path, json.dumps(state, ensure_ascii=False, indent=2) + "\n")
        save()
        api = runner.API(config)
        project_path = "/projects/" + quote(path, safe="")
        project = api.call("GET", project_path, missing_ok=True)
        if project:
            project_ok(project, path, state["creation_id"], state.get("project_id"))
        if "initial_sha" not in state:
            state["initial_sha"] = prepare_source(ROOT, sha, target, project_id, name.strip(), state["creation_id"], journal)
            state["phase"] = "initialized"
            save()
        require_clean(target, state["initial_sha"])
        if not project:
            require("project_id" not in state, "之前创建的项目已不存在，拒绝重新创建")
            matches = [n for n in api.items("/namespaces?search=" + quote(namespace.rsplit("/", 1)[-1], safe=""))
                       if n["full_path"] == namespace]
            require(len(matches) == 1, "目标 namespace 不可见或没有创建权限")
            project = api.call("POST", "/projects", {"namespace_id": matches[0]["id"], "path": project_id,
                "name": name.strip(), "description": "Project bootstrap: " + state["creation_id"],
                "visibility": "private", "initialize_with_readme": False, "default_branch": "main",
                "shared_runners_enabled": False, "group_runners_enabled": False})
        project_ok(project, path, state["creation_id"], state.get("project_id"))
        state.update(project_id=project["id"], project_url=project["web_url"], phase="created")
        save()
        result = runner.setup(config, path, branch="main")
        state.update(runner_id=result["runner_id"], runner_service=result["service"], phase="registered")
        save()
        url = config["gitlab_url"] + "/" + path + ".git"
        old_remote = git(["config", "--get-regexp", r"^remote\..*\.url$"], target) if (target / ".git/config").read_text().find('[remote ') >= 0 else ""
        require(not old_remote or old_remote == "remote.origin.url " + url, "本地 remote 已变化")
        if not old_remote:
            git(["remote", "add", "origin", url], target)
        env = auth_env(config, journal)
        remote_git(["fetch", "--no-tags", "origin"], target, env)
        refs = remote_git(["ls-remote", "--heads", "origin"], target, env)
        require(not refs or refs.split() == [state["initial_sha"], "refs/heads/main"], "远端已有不同提交或其他分支，拒绝覆盖")
        if not refs:
            remote_git(["push", "--set-upstream", "origin", "HEAD:refs/heads/main"], target, env)
        state["phase"] = "pushed"
        save()
        jobs = wait_pipeline(api, project["id"], state["initial_sha"], state["runner_id"], state, save, timeout)
        state["artifacts"] = artifact_evidence(api, project["id"], state["initial_sha"], state["pipeline_id"], jobs)
        branch = api.call("GET", f"/projects/{project['id']}/repository/branches/main")
        require(branch["protected"] and branch["commit"]["id"] == state["initial_sha"], "主分支或源码已漂移")
        runner.setup(config, path, mode="check", branch="main")
        require_clean(target, state["initial_sha"])
        state.update(phase="complete", deployment="unconfigured", receipt=str(state_path))
        save()
        return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="与 setup-runner 共用的私有 host JSON")
    parser.add_argument("--project", required=True, help="要创建的 namespace/project")
    parser.add_argument("--name", required=True, help="新项目名称")
    parser.add_argument("--destination", required=True, help="新的本地项目目录；父目录须已存在")
    parser.add_argument("--timeout", type=int, default=3600, help="本次等待 CI 秒数，60..7200，默认 3600")
    args = parser.parse_args()
    try:
        require(os.geteuid() == 0 and platform.system() == "Linux" and platform.machine() in ("x86_64", "amd64"), "请在 Linux/amd64 隔离构建机上以 root 执行")
        require(60 <= args.timeout <= 7200, "CI 等待上限必须为 60..7200 秒")
        config = runner.load_config(args.config)
        runner.run(["docker", "info", "--format", "{{.OSType}}/{{.Architecture}}"])
        runner.run(["gitlab-runner", "--version"])
        result = create(config, args.project, args.name, args.destination, args.timeout)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (runner.SetupError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print("[create-project] " + (str(exc) if isinstance(exc, runner.SetupError) else type(exc).__name__), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
