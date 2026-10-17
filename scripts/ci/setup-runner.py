#!/usr/bin/env python3
"""在已准备好的 Linux 构建机上初始化项目专用 GitLab Runner。"""

import argparse
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import platform
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import tomllib
from urllib import error, parse, request

ROOT = Path(__file__).resolve().parents[2]
STATE_ROOT = Path("/etc/gitlab-runner-projects")
UNIT_ROOT = Path("/etc/systemd/system")
WORK_ROOT = Path("/var/lib/gitlab-runner-projects")
APPARMOR_RESTRICTION = Path("/proc/sys/kernel/apparmor_restrict_unprivileged_userns")
APPARMOR_PROFILE = Path("/etc/apparmor.d/template-rootlesskit")
ENV_KEYS = {
    "HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "NO_PROXY", "no_proxy",
    "ALPINE_MIRROR", "GOPROXY",
}


class SetupError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise SetupError(message)


def private_read(path):
    path = Path(path)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.geteuid()
            and info.st_mode & 0o077 == 0, "配置和凭据必须为执行用户所有的普通文件，权限 0600")
    return path.read_text()


def atomic_write(path, content, mode=0o600):
    require(not path.is_symlink(), "拒绝覆盖符号链接")
    fd, name = tempfile.mkstemp(prefix=".setup-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            os.fchmod(stream.fileno(), mode)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def run(args):
    # 不透传子进程输出，避免 Runner 诊断意外携带认证 token。
    result = subprocess.run(args, capture_output=True, text=True, timeout=90, check=False)
    require(result.returncode == 0, f"主机命令失败：{Path(args[0]).name} {args[1] if len(args) > 1 else ''}")
    return result.stdout.strip()


def load_config(path):
    config = json.loads(private_read(path))
    require(isinstance(config, dict), "构建机配置必须为 JSON 对象")
    require(not set(config) - {"gitlab_url", "api_token_file", "environment", "extra_hosts"}, "未知构建机配置字段")
    url = parse.urlsplit(config["gitlab_url"])
    require(url.scheme == "https" and url.hostname and not url.username and not url.password
            and not url.query and not url.fragment and url.path in ("", "/"), "GitLab URL 必须为无凭据的 HTTPS 实例根地址")
    config["gitlab_url"] = config["gitlab_url"].rstrip("/")
    require(isinstance(config.get("environment", {}), dict), "environment 必须为对象")
    env = config.get("environment", {}).copy()
    require(not set(env) - ENV_KEYS, "CI 环境仅接受文档列出的网络变量；禁止注入 API 凭据或 CI 内置变量")
    require(all(isinstance(v, str) and not any(c in v for c in '\r\n\x00') for v in env.values()), "环境值必须为单行字符串")
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"):
        if env.get(key):
            proxy = parse.urlsplit(env[key])
            require(proxy.scheme in ("http", "https") and proxy.hostname, "代理必须使用 HTTP(S) URL")
    if env.get("ALPINE_MIRROR"):
        mirror = parse.urlsplit(env["ALPINE_MIRROR"])
        require(mirror.scheme == "https" and mirror.hostname and not mirror.username
                and not mirror.query and not mirror.fragment and mirror.path.rstrip("/").endswith("/alpine"), "Alpine 镜像必须为公开 HTTPS /alpine 地址")
    bypass = set()
    for key in ("NO_PROXY", "no_proxy"):
        bypass.update(v.strip() for v in env.get(key, "").split(",") if v.strip())
    bypass.update(["localhost", "127.0.0.1", "::1", "docker", url.hostname])
    env["NO_PROXY"] = env["no_proxy"] = ",".join(sorted(bypass))
    config["environment"] = env
    hosts = config.setdefault("extra_hosts", [])
    require(isinstance(hosts, list), "extra_hosts 必须为 host:IP 列表")
    for host in hosts:
        require(isinstance(host, str) and ":" in host, "extra_hosts 必须为 host:IP")
        name, address = host.split(":", 1)
        require(re.fullmatch(r"[A-Za-z0-9.-]+", name), "无效的 extra_hosts 主机名")
        ipaddress.ip_address(address)
    return config


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SetupError("GitLab API 返回重定向；请使用最终 HTTPS 实例地址，认证头不会被转发")


class API:
    def __init__(self, config):
        self.url = config["gitlab_url"] + "/api/v4"
        self.token = private_read(config["api_token_file"]).strip()
        require(self.token and not any(c.isspace() for c in self.token), "API token 文件为空或格式错误")
        # 管理 API 不经进程继承的代理；构建机须能直连其 GitLab HTTPS 地址。
        self.client = request.build_opener(request.ProxyHandler({}), NoRedirect())

    def call(self, method, path, data=None, missing_ok=False):
        req = request.Request(self.url + path, method=method,
                              data=None if data is None else json.dumps(data).encode(),
                              headers={"PRIVATE-TOKEN": self.token, "Content-Type": "application/json"})
        try:
            with self.client.open(req, timeout=30) as response:
                body = response.read()
                return json.loads(body) if body else None
        except error.HTTPError as exc:
            exc.close()
            if missing_ok and exc.code == 404:
                return None
            raise SetupError(f"GitLab {method} API 返回 HTTP {exc.code}；请核对项目权限和 token scopes") from None
        except (error.URLError, TimeoutError, OSError):
            raise SetupError("GitLab HTTPS 请求失败；保留本地状态后重跑，POST 结果不明时先核对同名 Runner") from None

    def items(self, path):
        result = []
        for page in range(1, 101):
            items = self.call("GET", f"{path}{'&' if '?' in path else '?'}per_page=100&page={page}")
            result.extend(items)
            if len(items) < 100:
                return result
        raise SetupError("API 分页超过安全范围")


def runner_ok(runner, project_id, name):
    require(runner["description"] == name and runner["runner_type"] == "project_type"
            and [p["id"] for p in runner.get("projects", [])] == [project_id], "Runner 归属不符，停止操作")
    require(runner["locked"] and not runner["run_untagged"]
            and runner["access_level"] == "ref_protected"
            and runner["tag_list"] == ["template-docker"], "Runner 权限或标签漂移，停止操作")


def render_config(config, token, runner_id, name):
    text = (ROOT / "server/deploy/ci-runner/config.toml.example").read_text()
    text = text.replace('name = "template-isolated-docker"', f"name = {json.dumps(name)}", 1)
    text = text.replace('url = "https://gitlab.example.com"', f"url = {json.dumps(config['gitlab_url'])}", 1)
    text = text.replace('token = ""', f"id = {runner_id}\n  token = {json.dumps(token)}", 1)
    env = ["FF_NETWORK_PER_BUILD=true"] + [f"{k}={v}" for k, v in sorted(config["environment"].items())]
    text = text.replace('environment = ["FF_NETWORK_PER_BUILD=true"]', f"environment = {json.dumps(env)}", 1)
    text = text.replace("[runners.docker]", "[runners.docker]\n    extra_hosts = " + json.dumps(config["extra_hosts"]), 1)
    require(tomllib.loads(text)["runners"][0]["token"] == token, "Runner 配置生成失败")
    return text


def service_text(binary, directory, working, name):
    return f"""# Managed by scripts/ci/setup-runner.py: {name}
[Unit]
Description=Project-scoped GitLab Docker Runner {name}
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
EnvironmentFile={directory}/manager.env
ExecStart={binary} run --config {directory}/config.toml --working-directory {working} --service {name}
Restart=always
RestartSec=10
KillSignal=SIGQUIT
TimeoutStopSec=7200
MemoryMax=256M
CPUQuota=50%
UMask=0077

[Install]
WantedBy=multi-user.target
"""


def ensure_directory(path):
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == os.geteuid()
            and info.st_mode & 0o077 == 0, "Runner 目录必须为 root 所有、权限 0700，且不能是符号链接")


def setup(config, project_path, mode="apply", branch=None, wait_seconds=90):
    require(re.fullmatch(r"[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+", project_path), "请传入完整 GitLab 项目路径")
    api = API(config)
    project = api.call("GET", "/projects/" + parse.quote(project_path, safe=""))
    require(project["path_with_namespace"] == project_path and not project["archived"], "项目路径不符或已归档")
    branch = branch or project.get("default_branch")
    require(branch, "空仓库需要 --branch 指定未来主分支，或先推送初始提交")
    require(not project.get("default_branch") or project["default_branch"] == branch, "指定分支必须是项目默认分支")
    instance = hashlib.sha256(config["gitlab_url"].encode()).hexdigest()[:10]
    key = f"{instance}-{project['id']}"
    name = "gitlab-runner-project-" + key
    directory, working = STATE_ROOT / key, WORK_ROOT / key
    state_path, toml_path = directory / "state.json", directory / "config.toml"
    unit_path = UNIT_ROOT / (name + ".service")
    ensure_directory(STATE_ROOT)
    # flock 随进程退出释放；不接管其他正在执行的初始化。
    lock_path = STATE_ROOT / (key + ".lock")
    require(not lock_path.is_symlink(), "拒绝符号链接锁")
    with open(lock_path, "a", opener=lambda p, flags: os.open(p, flags, 0o600)) as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SetupError("同一项目正在初始化，请等待该操作结束") from None
        expected = {"schema": 1, "gitlab_url": config["gitlab_url"], "project_id": project["id"],
                    "project_path": project_path, "service": name}
        if state_path.exists():
            state = json.loads(private_read(state_path))
            require(all(state.get(k) == v for k, v in expected.items()), "本地 Runner 状态归属不符")
        else:
            require(mode == "apply", "尚未初始化，请先执行初始化命令")
            require(not directory.exists() and not working.exists() and not unit_path.exists(), "目标文件已存在但没有本脚本状态，拒绝覆盖")
            ensure_directory(directory)
            state = expected.copy()
            atomic_write(state_path, json.dumps(state, indent=2) + "\n")
        ensure_directory(directory)
        if unit_path.exists():
            require(not unit_path.is_symlink() and unit_path.stat().st_uid == os.geteuid()
                    and unit_path.stat().st_mode & 0o022 == 0 and unit_path.read_text().startswith(
                f"# Managed by scripts/ci/setup-runner.py: {name}\n"), "systemd unit 非本脚本所有")
        if (directory / "manager.env").exists():
            private_read(directory / "manager.env")
        if "runner_id" not in state:
            require(not any(r["description"] == name for r in api.items(f"/projects/{project['id']}/runners")),
                    "发现同名远端 Runner 但未保存 token；请管理员核对后删除该未完成 Runner，再重跑")
            created = api.call("POST", "/user/runners", {
                "runner_type": "project_type", "project_id": project["id"], "description": name,
                "tag_list": ["template-docker"], "locked": True, "run_untagged": False,
                "access_level": "ref_protected", "maximum_timeout": 3600, "paused": True,
                "maintenance_note": "Managed by scripts/ci/setup-runner.py; dedicated project Docker executor.",
            })
            state["runner_id"] = created["id"]
            atomic_write(toml_path, render_config(config, created["token"], created["id"], name))
            atomic_write(state_path, json.dumps(state, indent=2) + "\n")
        runner_path = f"/runners/{state['runner_id']}"
        runner = api.call("GET", runner_path)
        runner_ok(runner, project["id"], name)
        saved = tomllib.loads(private_read(toml_path))["runners"][0]
        require(saved.get("id") == runner["id"] and saved["url"] == config["gitlab_url"]
                and saved["name"] == name, "本地认证配置归属不符")
        token = saved["token"]
        protection_path = f"/projects/{project['id']}/protected_branches/" + parse.quote(branch, safe="")
        protection = api.call("GET", protection_path, missing_ok=True)
        require(protection is None or not protection["allow_force_push"], "主分支允许强推，请先按项目决策收紧保护")
        if mode == "pause":
            api.call("PUT", runner_path, {"paused": True})
            require(not api.items(runner_path + "/jobs?status=running"), "Runner 已 pause；仍有 job 运行，结束后重跑 --pause")
            run(["systemctl", "disable", "--now", name])
            return {**expected, "runner_id": runner["id"], "status": "paused", "config_retained": True}
        desired = render_config(config, token, runner["id"], name)
        binary = shutil.which("gitlab-runner")
        require(binary and re.fullmatch(r"/[A-Za-z0-9_./-]+", binary), "gitlab-runner 路径无效")
        unit = service_text(binary, directory, working, name)
        manager_env = "".join(k + "=" + json.dumps(v) + "\n" for k, v in sorted(config["environment"].items())
                              if k not in ("ALPINE_MIRROR", "GOPROXY"))
        desired_files = {toml_path: desired, directory / "manager.env": manager_env, unit_path: unit}
        changed = any(not p.exists() or p.read_text() != value for p, value in desired_files.items())
        if mode == "check":
            require(not changed and protection and not runner["paused"] and runner["status"] == "online", "Runner、配置或主分支状态未就绪")
            require(run(["systemctl", "is-active", name]) == "active", "Runner 服务未运行")
        else:
            if changed:
                api.call("PUT", runner_path, {"paused": True})
                require(not api.items(runner_path + "/jobs?status=running"), "配置需更新但 Runner 有活动 job，请结束后重跑")
            if not protection:
                api.call("POST", f"/projects/{project['id']}/protected_branches", {
                    "name": branch, "allow_force_push": False, "push_access_level": 40,
                    "merge_access_level": 40, "unprotect_access_level": 40,
                })
            # 仅加载已核对的 RootlessKit 专用规则，保留全局 userns 限制。
            restriction = APPARMOR_RESTRICTION
            if restriction.exists() and restriction.read_text().strip() == "1":
                profile = APPARMOR_PROFILE
                source = (ROOT / "server/deploy/ci-runner/rootlesskit.apparmor").read_text()
                require(not profile.exists() or (not profile.is_symlink() and profile.read_text() == source), "现有 RootlessKit AppArmor 规则不同，拒绝覆盖")
                atomic_write(profile, source, 0o644)
                run(["apparmor_parser", "-r", str(profile)])
            ensure_directory(WORK_ROOT)
            ensure_directory(working)
            for path, value in desired_files.items():
                if not path.exists() or path.read_text() != value:
                    atomic_write(path, value, 0o644 if path == unit_path else 0o600)
            if changed:
                run(["systemctl", "daemon-reload"])
                run(["systemctl", "restart", name])
            run(["systemctl", "enable", "--now", name])
            if runner["paused"] or changed:
                api.call("PUT", runner_path, {"paused": False})
            deadline = time.monotonic() + wait_seconds
            while True:
                runner = api.call("GET", runner_path)
                runner_ok(runner, project["id"], name)
                if runner["status"] == "online" and not runner["paused"]:
                    break
                require(time.monotonic() < deadline, "等待 Runner online 超时；保留状态，可用同一命令恢复")
                time.sleep(3)
            require(run(["systemctl", "is-active", name]) == "active", "Runner 服务未运行")
        protection = api.call("GET", protection_path)
        require(not protection["allow_force_push"], "主分支保护回读失败")
        return {**expected, "runner_id": runner["id"], "status": "online", "branch": branch,
                "protected": True, "tag": "template-docker", "changed": changed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="root-only 构建机 JSON 配置")
    parser.add_argument("--project", required=True, help="GitLab namespace/project 路径")
    parser.add_argument("--branch", help="空仓库的未来默认分支；已存在时必须匹配")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="检查已初始化项目，不修改 Runner 或服务")
    modes.add_argument("--pause", action="store_true", help="pause 本脚本 Runner，空闲后停止独立服务，保留恢复配置")
    args = parser.parse_args()
    try:
        require(os.geteuid() == 0 and platform.system() == "Linux" and platform.machine() in ("x86_64", "amd64"),
                "请在 Linux/amd64 专用构建机上以 root 执行；需要 Python 3.11+、systemd、Docker 和 GitLab Runner")
        config = load_config(args.config)
        run(["docker", "info", "--format", "{{.OSType}}/{{.Architecture}}"])
        run(["gitlab-runner", "--version"])
        result = setup(config, args.project, "check" if args.check else "pause" if args.pause else "apply", args.branch)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (SetupError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        # 解析失败只报告异常类型，不输出可能含私密值的输入或 HTTP 响应。
        print("[ci:setup-runner] " + (str(exc) if isinstance(exc, SetupError) else type(exc).__name__), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
