#!/usr/bin/env python3
"""运行 Buildx；仅对 Docker Hub 拉取步骤中的网络瞬断作有界重试。"""

import base64
import binascii
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time

MAX_ATTEMPTS = 3
BACKOFF_SECONDS = (3, 10)
ROOT = Path(__file__).resolve().parents[1]
HUB_STEP = re.compile(
    r"^\[[^\]]+\] (?:load metadata for|FROM) docker\.io/[^\s]+(?: .*)?$"
)
TRANSIENT = re.compile(
    r"(?:\bunexpected EOF\b|\bEOF\b|connection reset by peer|"
    r"connection timed out|i/o timeout|TLS handshake timeout|"
    r"net/http: timeout awaiting response headers|"
    r"http2: (?:client connection lost|server sent GOAWAY)|"
    r"stream error: stream ID \d+; (?:INTERNAL_ERROR|PROTOCOL_ERROR))",
    re.IGNORECASE,
)
PERMANENT = re.compile(
    r"(?:unauthorized|authentication required|insufficient_scope|pull access denied|"
    r"\b(?:401|403|404|429)\b|toomanyrequests|rate limit|manifest unknown|"
    r"no match for platform|not found|certificate|\bx509\b|checksum|digest mismatch|"
    r"no space left|permission denied|context canceled|context cancelled|"
    r"failed to (?:mount|extract|unpack)|process .* did not complete)",
    re.IGNORECASE,
)


class BuildStatus:
    def __init__(self):
        self.vertices = {}
        self.malformed = False
        self.final_error = ""

    def entries(self, event, key):
        items = event.get(key, [])
        if not isinstance(items, list) or any(not isinstance(v, dict) for v in items):
            self.malformed = True
            return []
        return items

    def consume(self, event):
        vertices = self.entries(event, "vertexes")
        for vertex in vertices:
            if not isinstance(vertex, dict) or not isinstance(vertex.get("digest"), str):
                self.malformed = True
                continue
            self.vertices.setdefault(vertex["digest"], {}).update(vertex)

    def retryable(self):
        failures = [v for v in self.vertices.values() if v.get("error")]
        # 并行构建的其他步骤可能被取消；有任何真实非拉取错误时不得重试。
        failures = [v for v in failures if str(v["error"]).lower() not in (
            "context canceled", "context cancelled", "canceled", "cancelled"
        )]
        if self.malformed or not failures or not TRANSIENT.search(self.final_error) or PERMANENT.search(self.final_error):
            return False
        return all(
            HUB_STEP.fullmatch(str(v.get("name", "")))
            and TRANSIENT.search(str(v["error"]))
            and not PERMANENT.search(str(v["error"]))
            for v in failures
        )


def redact(text):
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "IMAGE_BUILD_PROXY"):
        if os.environ.get(key):
            text = text.replace(os.environ[key], "[PROXY]")
    text = re.sub(r"(https?://)[^\s/\"@]+@", r"\1[REDACTED]@", text)
    return re.sub(r"\bgl(?:rt|pat|cbt)-[A-Za-z0-9_.-]+", "[REDACTED]", text)


def attempt(args, log, status):
    child = subprocess.Popen(
        ["docker", "buildx", "build", "--progress=rawjson", *args],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        encoding="utf-8", errors="replace", start_new_session=True,
    )
    reported = set()
    last_transfer = 0.0

    def emit(value):
        text = redact(value)
        log.write(text + ("" if text.endswith("\n") else "\n"))
        log.flush()
        print(text, end="" if text.endswith("\n") else "\n", flush=True)

    try:
        for line in child.stdout:
            try:
                event = json.loads(line)
            except ValueError:
                if line.lstrip().startswith("{"):
                    status.malformed = True
                if line.startswith(("ERROR:", "error:")):
                    status.final_error = line.strip()
                emit(line)
                continue
            if not isinstance(event, dict):
                status.malformed = True
                emit(line)
                continue
            status.consume(event)
            for vertex in status.entries(event, "vertexes"):
                state = "ERROR" if vertex.get("error") else "DONE" if vertex.get("completed") else "START"
                key = (vertex.get("digest"), state)
                if key not in reported:
                    emit(f"[buildx] {vertex.get('name', '')}: {vertex.get('error') or state}")
                    reported.add(key)
            for entry in status.entries(event, "logs"):
                try:
                    emit(base64.b64decode(entry["data"], validate=True).decode("utf-8", errors="replace"))
                except (KeyError, TypeError, ValueError, binascii.Error):
                    status.malformed = True
                    emit("[buildx] 无法解析构建输出；失败时不自动重试")
            transfers = status.entries(event, "statuses")
            if transfers and time.monotonic() - last_transfer >= 10:
                for entry in transfers:
                    emit(f"[buildx] {entry.get('id', '')} {entry.get('current', 0)}/{entry.get('total', '?')}")
                last_transfer = time.monotonic()
            for warning in status.entries(event, "warnings"):
                emit("[buildx] " + json.dumps(warning, ensure_ascii=False))
        return child.wait()
    except BaseException:
        # 取消由父进程直接传递，不将中断当作网络失败继续构建。
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
        raise
    finally:
        child.stdout.close()


def build(args):
    if not args or any(v == "--progress" or v.startswith("--progress=") for v in args):
        raise ValueError("请由 make build_server 调用；进度格式由恢复入口管理")
    log_root = Path(os.environ.get("IMAGE_BUILD_LOG_ROOT", ROOT / "output/image-build"))
    log_root.mkdir(parents=True, exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix="build-", dir=log_root))
    print(f"[image-build] 构建日志：{folder}", flush=True)
    receipt = {"max_attempts": MAX_ATTEMPTS, "attempts": [], "status": "running"}

    def save():
        (folder / "result.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")

    save()
    for number in range(1, MAX_ATTEMPTS + 1):
        status = BuildStatus()
        try:
            with (folder / f"attempt-{number}.log").open("w") as log:
                code = attempt(args, log, status)
        except (KeyboardInterrupt, OSError):
            receipt["status"] = "interrupted"
            save()
            raise
        transient = code > 0 and status.retryable()
        retry = transient and number < MAX_ATTEMPTS
        row = {"number": number, "exit_code": code, "transient_hub_network": bool(transient),
               "retry": retry, "log": f"attempt-{number}.log"}
        receipt["attempts"].append(row)
        receipt["status"] = "retrying" if retry else "success" if code == 0 else "failed"
        save()
        if not retry:
            if code:
                print("[image-build] 已达重试上限或不属于 Docker Hub 网络瞬断，构建失败", file=sys.stderr)
            return code if code >= 0 else 128 - code
        delay = BACKOFF_SECONDS[number - 1]
        row["backoff_seconds"] = delay
        save()
        print(f"[image-build] Docker Hub 网络瞬断；{delay} 秒后自动重试（{number + 1}/{MAX_ATTEMPTS}）", flush=True)
        try:
            time.sleep(delay)
        except KeyboardInterrupt:
            receipt["status"] = "interrupted"
            save()
            raise


def interrupted(*_):
    raise KeyboardInterrupt


def main():
    signal.signal(signal.SIGTERM, interrupted)
    try:
        args = sys.argv[1:]
        return build(args[1:] if args[:1] == ["--"] else args)
    except KeyboardInterrupt:
        print("[image-build] 构建已中断，不重试", file=sys.stderr)
        return 130
    except (OSError, ValueError) as exc:
        print("[image-build] " + redact(str(exc)), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
