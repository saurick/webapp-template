#!/usr/bin/env python3
import html
import json
import os
import shutil
import socket
import ssl
import subprocess
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

LISTEN_HOST = os.getenv("LAB_OBSERVER_LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("LAB_OBSERVER_LISTEN_PORT", "30088"))
PROBE_TIMEOUT_SECONDS = float(os.getenv("LAB_OBSERVER_TIMEOUT_SECONDS", "2"))
REFRESH_SECONDS = int(os.getenv("LAB_OBSERVER_REFRESH_SECONDS", "5"))
POWER_SEQUENCE_URL = os.getenv(
    "LAB_OBSERVER_POWER_SEQUENCE_URL",
    "https://github.com/saurick/webapp-template/blob/master/server/deploy/lab-ha/docs/VM_POWER_SEQUENCE.md",
)
RECOVERY_RUNBOOK_URL = os.getenv(
    "LAB_OBSERVER_RECOVERY_RUNBOOK_URL",
    "https://github.com/saurick/webapp-template/blob/master/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md",
)
PING_BINARY = shutil.which("ping")

NODES = [
    {
        "name": "node1",
        "ip": "192.168.0.7",
        "boot_order": 3,
        "shutdown_order": 1,
        "boot_role": "最后补齐第三台控制面，完成收敛。",
        "shutdown_role": "非固定入口控制面，优先下线。",
    },
    {
        "name": "node2",
        "ip": "192.168.0.108",
        "boot_order": 2,
        "shutdown_order": 2,
        "boot_role": "固定管理入口，Portal / GitLab / Harbor / Argo 在这台。",
        "shutdown_role": "固定管理入口，保留到倒数第二步。",
    },
    {
        "name": "node3",
        "ip": "192.168.0.128",
        "boot_order": 1,
        "shutdown_order": 3,
        "boot_role": "先拉起一台控制面，给 quorum 打底。",
        "shutdown_role": "最后保留的控制面，改到虚拟化平台收尾。",
    },
]
BOOT_ORDER = ["node3", "node2", "node1"]
SHUTDOWN_ORDER = ["node1", "node2", "node3"]
NODE_BY_NAME = {item["name"]: item for item in NODES}
BOOT_GATE_LABELS = {
    "nodes": "节点",
    "entry-node": "固定入口",
    "core": "核心服务",
    "urls": "入口检测",
    "ssh": "SSH",
    "signals": "关键探针",
}
SHUTDOWN_GATE_LABELS = {
    "stopped": "已完成步骤",
    "remaining": "剩余 Ready 节点",
    "core": "核心服务",
    "urls": "入口检测",
    "reachable": "当前可达节点",
    "signals": "关键探针",
}
SIGNALS = [
    {"key": "api-vip", "label": "K8s API VIP", "kind": "tcp", "host": "192.168.0.110", "port": 6443},
    {"key": "portal", "label": "集群内 Portal", "kind": "http", "url": "http://192.168.0.108:30088/"},
    {"key": "lab", "label": "WebApp Lab /readyz", "kind": "http", "url": "http://192.168.0.108:32668/readyz"},
]
PORTAL_LIVE_BOOT_URL = "http://192.168.0.108:30088/alert-sink-api/ops/live/cold-start"
PORTAL_LIVE_SHUTDOWN_URL = "http://192.168.0.108:30088/alert-sink-api/ops/live/shutdown"


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


def format_local_time(value):
    if not value:
        return ""
    try:
        return datetime.fromisoformat(value).astimezone().strftime("%m/%d %H:%M:%S")
    except ValueError:
        return value


def escape(value):
    return html.escape(str(value), quote=True)


def build_status_class(status):
    if status == "ok":
        return "status-ok"
    if status == "fail":
        return "status-fail"
    return "status-warn"


def build_probe_badge(status, label):
    status_class = {
        "ok": "badge-ok",
        "fail": "badge-fail",
    }.get(status, "badge-warn")
    return f'<span class="badge {status_class}">{escape(label)}</span>'


def ensure_dict_list(items):
    return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []


def ensure_text_list(items):
    return [str(item) for item in items if str(item)] if isinstance(items, list) else []


def build_ratio_status(ready, total):
    if total > 0 and ready >= total:
        return "ok"
    if ready <= 0:
        return "fail"
    return "warn"


def make_gate(key, label, ready, total, blocked=None, status=None):
    return {
        "key": key,
        "label": label,
        "ready": ready,
        "total": total,
        "blocked": ensure_text_list(blocked or []),
        "status": status or build_ratio_status(ready, total),
    }


def normalize_progress_nodes(kind, live_nodes, next_node):
    order_names = BOOT_ORDER if kind == "boot" else SHUTDOWN_ORDER
    done_key = "ready" if kind == "boot" else "stopped"
    done_state = "ready" if kind == "boot" else "stopped"
    role_key = "boot_role" if kind == "boot" else "shutdown_role"
    order_key = "boot_order" if kind == "boot" else "shutdown_order"
    live_by_name = {item["name"]: item for item in ensure_dict_list(live_nodes) if item.get("name")}
    items = []
    for name in order_names:
        base = NODE_BY_NAME[name]
        live = live_by_name.get(name, {})
        is_done = bool(live.get(done_key))
        is_next = bool(next_node == name and not is_done)
        items.append(
            {
                "name": name,
                "ip": base["ip"],
                "order": base[order_key],
                "role": base[role_key],
                "state": done_state if is_done else ("next" if is_next else "waiting"),
                "status": live.get("status", "ok" if is_done else ("warn" if is_next else "fail")),
            }
        )
    return items


def normalize_portal_gates(kind, gates):
    labels = BOOT_GATE_LABELS if kind == "boot" else SHUTDOWN_GATE_LABELS
    normalized = []
    for gate in ensure_dict_list(gates):
        key = gate.get("key", "")
        normalized.append(
            make_gate(
                key=key,
                label=labels.get(key, key),
                ready=int(gate.get("ready", 0) or 0),
                total=int(gate.get("total", 0) or 0),
                blocked=gate.get("blocked", []),
                status=gate.get("status", "warn"),
            )
        )
    return normalized


def ping_probe(host):
    if not PING_BINARY:
        return {"ok": False, "status": "warn", "label": "Ping 未安装"}
    try:
        result = subprocess.run(
            [PING_BINARY, "-c", "1", "-W", str(max(int(PROBE_TIMEOUT_SECONDS), 1)), host],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=PROBE_TIMEOUT_SECONDS + 1,
        )
        if result.returncode == 0:
            return {"ok": True, "status": "ok", "label": "Ping 通"}
        return {"ok": False, "status": "fail", "label": "Ping 不通"}
    except Exception:
        return {"ok": False, "status": "fail", "label": "Ping 不通"}


def tcp_probe(host, port):
    try:
        with socket.create_connection((host, port), timeout=PROBE_TIMEOUT_SECONDS):
            return True
    except OSError:
        return False


def http_request(url, parse_json=False):
    request = Request(url, headers={"User-Agent": "lab-observer/1.0"})
    context = ssl._create_unverified_context()
    try:
        with urlopen(request, timeout=PROBE_TIMEOUT_SECONDS, context=context) as response:
            body = response.read()
            data = None
            if parse_json:
                data = json.loads(body.decode("utf-8"))
            return {"ok": response.status == HTTPStatus.OK, "status_code": response.status, "data": data}
    except HTTPError as exc:
        return {"ok": False, "status_code": exc.code, "data": None}
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return {"ok": False, "status_code": 0, "data": None}


def count_contiguous(items, predicate):
    count = 0
    for item in items:
        if predicate(item):
            count += 1
            continue
        break
    return count


def ordered_nodes(node_map, order_names):
    return [node_map[name] for name in order_names]


def build_node_snapshots():
    snapshots = []
    for node in NODES:
        ping = ping_probe(node["ip"])
        ssh_ok = tcp_probe(node["ip"], 22)
        snapshots.append(
            {
                **node,
                "ping_ok": ping["ok"],
                "ping_status": ping["status"],
                "ping_label": ping["label"],
                "ssh_ok": ssh_ok,
                "reachable": ping["ok"] or ssh_ok,
            }
        )
    return snapshots


def build_signal_snapshots():
    items = []
    for signal in SIGNALS:
        if signal["kind"] == "tcp":
            ok = tcp_probe(signal["host"], signal["port"])
            status_code = signal["port"] if ok else 0
        else:
            response = http_request(signal["url"])
            ok = response["ok"]
            status_code = response["status_code"]
        items.append(
            {
                "key": signal["key"],
                "label": signal["label"],
                "ok": ok,
                "status": "ok" if ok else "fail",
                "status_code": status_code,
            }
        )
    return items


def signal_map(signals):
    return {item["key"]: item for item in signals}


def build_boot_from_portal(data):
    status_text = {
        "complete": "冷启动完成",
        "stabilizing": "工作负载收敛中",
        "out-of-order": "顺序需复核",
        "unavailable": "暂不可用",
    }.get(data.get("phase"), "可以继续开下一台")
    if data.get("phase") == "unavailable":
        summary = "集群内 Portal live API 暂不可用。"
    else:
        summary = (
            f'节点 {data.get("ready_nodes", 0)}/{data.get("total_nodes", 0)} 已就绪 · '
            f'核心服务 {data.get("core_ready", 0)}/{data.get("core_total", 0)} · '
            f'入口 {data.get("url_ok", 0)}/{data.get("url_total", 0)}'
        )
    detail = ""
    if data.get("phase") == "complete":
        detail = "集群内 Portal 已接管完整冷启动观察；后续优先看 192.168.0.108:30088。"
    elif data.get("next_node"):
        detail = f'下一台建议：{data.get("next_node")}（{data.get("next_node_ip") or "n/a"}）'
    elif data.get("error"):
        detail = data["error"]
    return {
        "source": "portal-live",
        "status": data.get("status", "warn"),
        "phase": data.get("phase", ""),
        "headline": status_text,
        "summary": summary,
        "detail": detail,
        "checked_at": data.get("checked_at", ""),
        "nodes": normalize_progress_nodes("boot", data.get("nodes", []), data.get("next_node", "")),
        "gates": normalize_portal_gates("boot", data.get("gates", [])),
    }


def build_shutdown_from_portal(data):
    status_text = {
        "complete": "关机完成",
        "stabilizing": "剩余栈收敛中",
        "portal-last-visible-step": "再下一步 Portal 会下线",
        "out-of-order": "顺序需复核",
        "unavailable": "暂不可用",
    }.get(data.get("phase"), "可以继续关下一台")
    if data.get("phase") == "unavailable":
        summary = "集群内 Portal live API 暂不可用。"
    else:
        summary = (
            f'已退出 Ready {data.get("stopped_nodes", 0)}/{data.get("total_nodes", 0)} · '
            f'剩余节点 {data.get("remaining_ready_nodes", 0)}/{data.get("remaining_total_nodes", 0)} · '
            f'核心服务 {data.get("core_ready", 0)}/{data.get("core_total", 0)} · '
            f'入口 {data.get("url_ok", 0)}/{data.get("url_total", 0)}'
        )
    detail = ""
    if data.get("portal_last_visible_step"):
        detail = "关完 node2 后，改到虚拟化平台确认最后一台 node3。"
    elif data.get("next_node"):
        detail = f'下一台建议：{data.get("next_node")}（{data.get("next_node_ip") or "n/a"}）'
    elif data.get("error"):
        detail = data["error"]
    return {
        "source": "portal-live",
        "status": data.get("status", "warn"),
        "phase": data.get("phase", ""),
        "headline": status_text,
        "summary": summary,
        "detail": detail,
        "checked_at": data.get("checked_at", ""),
        "nodes": normalize_progress_nodes("shutdown", data.get("nodes", []), data.get("next_node", "")),
        "gates": normalize_portal_gates("shutdown", data.get("gates", [])),
    }


def build_external_boot(nodes, signals):
    nodes_by_name = {item["name"]: item for item in nodes}
    ordered = ordered_nodes(nodes_by_name, BOOT_ORDER)
    contiguous_ready = count_contiguous(ordered, lambda item: item["ssh_ok"] or item["reachable"])
    reachable_count = sum(1 for item in nodes if item["reachable"])
    ssh_count = sum(1 for item in nodes if item["ssh_ok"])
    out_of_order = any((item["ssh_ok"] or item["reachable"]) for item in ordered[contiguous_ready:])
    next_node = ordered[contiguous_ready] if contiguous_ready < len(ordered) else None
    signal_by_key = signal_map(signals)
    portal_ok = signal_by_key["portal"]["ok"]
    api_ok = signal_by_key["api-vip"]["ok"]
    probe_ok = sum(1 for item in signals if item["ok"])
    probe_blocked = [item["label"] for item in signals if not item["ok"]]
    live_nodes = [{"name": item["name"], "ready": bool(item["ssh_ok"] or item["reachable"])} for item in ordered]
    gates = [
        make_gate("nodes", BOOT_GATE_LABELS["nodes"], reachable_count, len(nodes)),
        make_gate("ssh", BOOT_GATE_LABELS["ssh"], ssh_count, len(nodes)),
        make_gate(
            "entry-node",
            BOOT_GATE_LABELS["entry-node"],
            1 if (nodes_by_name["node2"]["reachable"] or nodes_by_name["node2"]["ssh_ok"]) else 0,
            1,
        ),
        make_gate("signals", BOOT_GATE_LABELS["signals"], probe_ok, len(signals), blocked=probe_blocked),
    ]
    if out_of_order:
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": "out-of-order",
            "headline": "顺序需复核",
            "summary": "当前可达节点与推荐开机顺序不一致，请先看虚拟化控制台。",
            "detail": "建议按 node3 -> node2 -> node1 重新核对是否有跳步上电。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("boot", live_nodes, next_node["name"] if next_node else ""),
            "gates": gates,
        }
    if reachable_count == 0:
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": "waiting-node3",
            "headline": "等待第一台开机",
            "summary": "三台节点当前都不可达，外置观察页仍在线等待接管。",
            "detail": "建议先启动 node3，再等待 SSH 或控制台进入稳定阶段。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("boot", live_nodes, "node3"),
            "gates": gates,
        }
    if contiguous_ready < len(ordered):
        detail = f'外部已看到节点可达 {reachable_count}/3，SSH 就绪 {ssh_count}/3。'
        if next_node and next_node["name"] == "node2":
            detail += " 固定管理入口 node2 还没起来，Portal / GitLab / Harbor / Argo 暂时不可用。"
        elif next_node and next_node["name"] == "node1":
            detail += " 前两台控制面已经可达，等第三台补齐后再看集群内 Portal。"
        else:
            detail += " 只起了一台时，etcd quorum 还没回来。"
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": f'waiting-{next_node["name"]}' if next_node else "stabilizing",
            "headline": "继续按顺序开机",
            "summary": f'当前下一台建议：{next_node["name"]}（{next_node["ip"]}）' if next_node else "节点仍在恢复。",
            "detail": detail,
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("boot", live_nodes, next_node["name"] if next_node else ""),
            "gates": gates,
        }
    if portal_ok:
        return {
            "source": "external-probes",
            "status": "ok",
            "phase": "portal-handoff",
            "headline": "切回集群内 Portal",
            "summary": "固定入口 node2 已恢复，集群内 Portal 可以接管更细的工作负载与入口状态。",
            "detail": "继续看 192.168.0.108:30088；当前这张外置页主要负责掉电前后不断线观察。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("boot", live_nodes, ""),
            "gates": gates,
        }
    if api_ok:
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": "stabilizing",
            "headline": "控制面已恢复，固定入口未回",
            "summary": "三台节点已经可达，K8s API VIP 已响应，但固定入口 node2 仍未完全接管。",
            "detail": "Portal / GitLab / Harbor / Argo 还可能打不开，继续等待 node2 的 30088 接管。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("boot", live_nodes, ""),
            "gates": gates,
        }
    return {
        "source": "external-probes",
        "status": "warn",
        "phase": "stabilizing",
        "headline": "节点可达，控制面未接管",
        "summary": "三台节点都已可达，但 API VIP 与 Portal 还没完全接管。",
        "detail": "继续观察 192.168.0.110:6443 和 192.168.0.108:30088 是否回绿。",
        "checked_at": utc_now_iso(),
        "nodes": normalize_progress_nodes("boot", live_nodes, ""),
        "gates": gates,
    }


def build_external_shutdown(nodes, signals):
    nodes_by_name = {item["name"]: item for item in nodes}
    ordered = ordered_nodes(nodes_by_name, SHUTDOWN_ORDER)
    contiguous_stopped = count_contiguous(ordered, lambda item: not item["reachable"] and not item["ssh_ok"])
    stopped_count = sum(1 for item in nodes if not item["reachable"] and not item["ssh_ok"])
    reachable_count = sum(1 for item in nodes if item["reachable"])
    out_of_order = any((not item["reachable"] and not item["ssh_ok"]) for item in ordered[contiguous_stopped:])
    next_node = ordered[contiguous_stopped] if contiguous_stopped < len(ordered) else None
    signal_by_key = signal_map(signals)
    portal_ok = signal_by_key["portal"]["ok"]
    probe_ok = sum(1 for item in signals if item["ok"])
    probe_blocked = [item["label"] for item in signals if not item["ok"]]
    live_nodes = [{"name": item["name"], "stopped": bool(not item["reachable"] and not item["ssh_ok"])} for item in ordered]
    gates = [
        make_gate("stopped", SHUTDOWN_GATE_LABELS["stopped"], stopped_count, len(nodes)),
        make_gate("reachable", SHUTDOWN_GATE_LABELS["reachable"], reachable_count, len(nodes)),
        make_gate(
            "entry-node",
            BOOT_GATE_LABELS["entry-node"],
            1 if (nodes_by_name["node2"]["reachable"] or nodes_by_name["node2"]["ssh_ok"]) else 0,
            1,
        ),
        make_gate("signals", SHUTDOWN_GATE_LABELS["signals"], probe_ok, len(signals), blocked=probe_blocked),
    ]
    if out_of_order:
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": "out-of-order",
            "headline": "顺序需复核",
            "summary": "当前离线节点与推荐关机顺序不一致，请先核对虚拟化平台电源状态。",
            "detail": "建议按 node1 -> node2 -> node3 收尾，不要跳过固定入口 node2 后再回头补。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("shutdown", live_nodes, next_node["name"] if next_node else ""),
            "gates": gates,
        }
    if stopped_count == len(ordered):
        return {
            "source": "external-probes",
            "status": "ok",
            "phase": "complete",
            "headline": "整套已关闭",
            "summary": "三台节点当前都不可达；最终状态仍以虚拟化平台电源页为准。",
            "detail": "外置观察页仍在线，可用于等待下一轮开机。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("shutdown", live_nodes, ""),
            "gates": gates,
        }
    if not portal_ok and stopped_count >= 2:
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": "portal-last-visible-step",
            "headline": "Portal 已下线，改看虚拟化平台",
            "summary": f"当前已离线 {stopped_count}/3 台；固定入口 node2 已下线后，集群内 Portal 不再可用。",
            "detail": "如果 node3 还在运行，请直接到虚拟化控制台完成最后一步，并以电源状态为准。",
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("shutdown", live_nodes, next_node["name"] if next_node else ""),
            "gates": gates,
        }
    if next_node:
        return {
            "source": "external-probes",
            "status": "warn",
            "phase": f'waiting-{next_node["name"]}',
            "headline": "继续按顺序关机",
            "summary": f'当前下一台建议：{next_node["name"]}（{next_node["ip"]}）',
            "detail": f'外部已看到离线 {stopped_count}/3 台，剩余可达 {reachable_count}/3 台。关掉 node2 后，改由虚拟化平台完成最终收尾。',
            "checked_at": utc_now_iso(),
            "nodes": normalize_progress_nodes("shutdown", live_nodes, next_node["name"] if next_node else ""),
            "gates": gates,
        }
    return {
        "source": "external-probes",
        "status": "warn",
        "phase": "unavailable",
        "headline": "等待外部探针刷新",
        "summary": "当前无法从集群内 Portal 获取关机 live 状态，继续以外部可达性和虚拟化平台为准。",
        "detail": "",
        "checked_at": utc_now_iso(),
        "nodes": normalize_progress_nodes("shutdown", live_nodes, ""),
        "gates": gates,
    }


def collect_snapshot():
    nodes = build_node_snapshots()
    signals = build_signal_snapshots()
    boot_live = http_request(PORTAL_LIVE_BOOT_URL, parse_json=True)
    shutdown_live = http_request(PORTAL_LIVE_SHUTDOWN_URL, parse_json=True)
    boot_state = build_boot_from_portal(boot_live["data"]) if boot_live["ok"] and isinstance(boot_live["data"], dict) else build_external_boot(nodes, signals)
    shutdown_state = build_shutdown_from_portal(shutdown_live["data"]) if shutdown_live["ok"] and isinstance(shutdown_live["data"], dict) else build_external_shutdown(nodes, signals)
    return {
        "checked_at": utc_now_iso(),
        "observer": {
            "host": socket.gethostname(),
            "listen": f"http://{LISTEN_HOST if LISTEN_HOST != '0.0.0.0' else '0.0.0.0'}:{LISTEN_PORT}",
            "refresh_seconds": REFRESH_SECONDS,
        },
        "boot": boot_state,
        "shutdown": shutdown_state,
        "nodes": nodes,
        "signals": signals,
    }


def render_signal_cards(signals):
    cards = []
    for signal in signals:
        detail = f'响应 {signal["status_code"]}' if signal["status_code"] else "当前不可达"
        cards.append(
            f"""
            <div class="mini-card">
              <div class="mini-label">{escape(signal["label"])}</div>
              <div class="mini-value {build_status_class(signal['status'])}">{escape('可用' if signal['ok'] else '不可用')}</div>
              <div class="mini-detail">{escape(detail)}</div>
            </div>
            """
        )
    return "".join(cards)


def render_nodes(nodes):
    cards = []
    for node in sorted(nodes, key=lambda item: item["boot_order"]):
        ssh_label = "22/TCP 通" if node["ssh_ok"] else "22/TCP 不通"
        ssh_status = "ok" if node["ssh_ok"] else "fail"
        cards.append(
            f"""
            <article class="node-card">
              <div class="node-head">
                <div>
                  <h3>{escape(node["name"])}</h3>
                  <div class="node-ip">{escape(node["ip"])}</div>
                </div>
                <div class="node-order">
                  <span class="order-chip">开机 #{node["boot_order"]}</span>
                  <span class="order-chip order-chip-secondary">关机 #{node["shutdown_order"]}</span>
                </div>
              </div>
              <div class="node-badges">
                {build_probe_badge(node["ping_status"], node["ping_label"])}
                {build_probe_badge(ssh_status, ssh_label)}
              </div>
              <div class="node-detail">开机理由：{escape(node["boot_role"])}</div>
              <div class="node-detail">关机理由：{escape(node["shutdown_role"])}</div>
            </article>
            """
        )
    return "".join(cards)


def progress_step_label(kind, state):
    if kind == "boot":
        return {
            "ready": "已就绪",
            "next": "下一台",
            "waiting": "等待中",
        }.get(state, "等待中")
    return {
        "stopped": "已退出 Ready",
        "next": "下一台",
        "waiting": "保持运行",
    }.get(state, "保持运行")


def render_progress_steps(kind, items):
    if not items:
        return ""
    cards = []
    for item in items:
        state = item.get("state", "waiting")
        cards.append(
            f"""
            <div class="progress-step progress-step-{escape(state)}">
              <div class="progress-step-index">{escape(item.get("order", ""))}</div>
              <div class="progress-step-copy">
                <strong>{escape(item.get("name", ""))}</strong>
                <small>{escape(item.get("ip", ""))}</small>
                <small class="progress-step-hint">{escape(item.get("role", ""))}</small>
              </div>
              <div class="progress-step-state">{escape(progress_step_label(kind, state))}</div>
            </div>
            """
        )
    return "".join(cards)


def render_gate_cards(gates):
    if not gates:
        return ""
    cards = []
    for gate in gates:
        detail = ""
        if gate.get("blocked"):
            detail = "未回绿：" + "、".join(gate["blocked"])
        cards.append(
            f"""
            <div class="gate-card">
              <div class="gate-label">{escape(gate.get("label", gate.get("key", "")))}</div>
              <div class="gate-value {build_status_class(gate.get('status', 'warn'))}">{escape(f"{gate.get('ready', 0)}/{gate.get('total', 0)}")}</div>
              <div class="gate-detail{' hidden' if not detail else ''}">{escape(detail)}</div>
            </div>
            """
        )
    return "".join(cards)


def render_state_card(title, kind, state, action_href, action_label):
    checked = format_local_time(state.get("checked_at", ""))
    source_label = "来源：集群内 Portal live" if state.get("source") == "portal-live" else "来源：集群外探针"
    phase = state.get("phase", "")
    phase_label = f'阶段：{state.get("headline", phase)}' if phase else ""
    step_cards = render_progress_steps(kind, state.get("nodes", []))
    gate_cards = render_gate_cards(state.get("gates", []))
    return f"""
      <section class="card">
        <div class="eyebrow">{escape(source_label)}</div>
        <h2>{escape(title)}</h2>
        <div class="hero-value {build_status_class(state.get('status', 'warn'))}">{escape(state.get('headline', ''))}</div>
        <p class="summary">{escape(state.get('summary', ''))}</p>
        <p class="detail">{escape((checked + ' · ') if checked else '')}{escape(state.get('detail', ''))}</p>
        <div class="phase-line{' hidden' if not phase_label else ''}">{escape(phase_label)}</div>
        <div class="progress-board{' hidden' if not step_cards else ''}">
          <div class="section-title">推荐顺序与当前阶段</div>
          <div class="progress-steps">
            {step_cards}
          </div>
        </div>
        <div class="gate-grid{' hidden' if not gate_cards else ''}">
          {gate_cards}
        </div>
        <div class="actions">
          <a href="{escape(action_href)}" target="_blank" rel="noreferrer">{escape(action_label)}</a>
        </div>
      </section>
    """


def render_html(snapshot):
    checked_at = format_local_time(snapshot["checked_at"])
    observer_host = snapshot["observer"]["host"]
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="{REFRESH_SECONDS}" />
  <title>Lab Observer</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0f1b2b;
      --panel-2: #122235;
      --line: rgba(160, 190, 230, 0.12);
      --text: #edf6ff;
      --muted: #9fb5d4;
      --ok: #7bd88f;
      --warn: #ffd166;
      --fail: #ff7b72;
      --accent: #66d9ef;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(102,217,239,0.14), transparent 30%),
        linear-gradient(180deg, #07111f 0%, #09131f 100%);
      color: var(--text);
    }}
    .wrap {{
      max-width: 1240px;
      margin: 0 auto;
      padding: 28px 20px 40px;
    }}
    .hero, .card, .mini-card, .node-card {{
      background: linear-gradient(180deg, rgba(18,34,53,0.96), rgba(11,22,35,0.96));
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.28);
    }}
    .hero {{
      padding: 22px 24px;
      margin-bottom: 18px;
    }}
    .hero h1 {{
      margin: 0 0 10px;
      font-size: 30px;
    }}
    .hero p {{
      margin: 0;
      color: var(--muted);
      line-height: 1.65;
    }}
    .hero-meta {{
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .chip {{
      border-radius: 999px;
      padding: 7px 12px;
      background: rgba(255,255,255,0.04);
      color: var(--muted);
      border: 1px solid rgba(255,255,255,0.05);
      font-size: 13px;
    }}
    .grid-two {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }}
    .card {{
      padding: 20px;
    }}
    .eyebrow {{
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 10px;
    }}
    h2 {{
      margin: 0 0 10px;
      font-size: 22px;
    }}
    .hero-value {{
      font-size: 18px;
      font-weight: 800;
      margin-bottom: 10px;
    }}
    .status-ok {{ color: var(--ok); }}
    .status-warn {{ color: var(--warn); }}
    .status-fail {{ color: var(--fail); }}
    .summary, .detail {{
      margin: 0;
      line-height: 1.7;
    }}
    .summary {{ color: var(--text); }}
    .detail {{
      margin-top: 10px;
      color: var(--muted);
      font-size: 14px;
    }}
    .hidden {{ display: none; }}
    .phase-line {{
      margin-top: 10px;
      color: var(--muted);
      font-size: 13px;
    }}
    .actions {{
      margin-top: 16px;
    }}
    .actions a {{
      display: inline-flex;
      text-decoration: none;
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(102,217,239,0.12);
      color: var(--accent);
      border: 1px solid rgba(102,217,239,0.18);
      font-weight: 700;
      font-size: 14px;
    }}
    .mini-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }}
    .mini-card {{
      padding: 16px;
    }}
    .mini-label {{
      color: var(--muted);
      font-size: 13px;
    }}
    .mini-value {{
      margin-top: 8px;
      font-size: 18px;
      font-weight: 800;
    }}
    .mini-detail {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }}
    .section-title {{
      margin-top: 18px;
      margin-bottom: 12px;
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }}
    .progress-steps {{
      display: grid;
      gap: 10px;
    }}
    .progress-step {{
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.02);
    }}
    .progress-step-ready {{
      background: rgba(123,216,143,0.08);
      border-color: rgba(123,216,143,0.18);
    }}
    .progress-step-next {{
      background: rgba(102,217,239,0.08);
      border-color: rgba(102,217,239,0.18);
    }}
    .progress-step-waiting {{
      background: rgba(255,209,102,0.06);
      border-color: rgba(255,209,102,0.12);
    }}
    .progress-step-stopped {{
      background: rgba(123,216,143,0.08);
      border-color: rgba(123,216,143,0.18);
    }}
    .progress-step-index {{
      width: 38px;
      height: 38px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(255,255,255,0.04);
      color: var(--text);
      font-weight: 800;
      flex: 0 0 auto;
    }}
    .progress-step-copy {{
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    .progress-step-copy strong {{
      font-size: 18px;
    }}
    .progress-step-copy small {{
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }}
    .progress-step-state {{
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(255,255,255,0.05);
      font-size: 12px;
      font-weight: 800;
    }}
    .gate-grid {{
      margin-top: 16px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
    }}
    .gate-card {{
      padding: 14px;
      border-radius: 18px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.02);
    }}
    .gate-label {{
      color: var(--muted);
      font-size: 13px;
    }}
    .gate-value {{
      margin-top: 8px;
      font-size: 20px;
      font-weight: 800;
    }}
    .gate-detail {{
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }}
    .nodes {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }}
    .node-card {{
      padding: 18px;
    }}
    .node-head {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
      margin-bottom: 12px;
    }}
    .node-head h3 {{
      margin: 0;
      font-size: 22px;
    }}
    .node-ip {{
      margin-top: 6px;
      color: var(--muted);
      font-size: 15px;
    }}
    .node-order {{
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: end;
    }}
    .order-chip {{
      border-radius: 999px;
      padding: 5px 10px;
      background: rgba(123,216,143,0.12);
      color: var(--ok);
      border: 1px solid rgba(123,216,143,0.16);
      font-size: 12px;
      font-weight: 800;
    }}
    .order-chip-secondary {{
      background: rgba(255,209,102,0.12);
      color: var(--warn);
      border-color: rgba(255,209,102,0.16);
    }}
    .node-badges {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }}
    .badge {{
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 700;
    }}
    .badge-ok {{
      background: rgba(123,216,143,0.12);
      color: var(--ok);
    }}
    .badge-fail {{
      background: rgba(255,123,114,0.12);
      color: var(--fail);
    }}
    .badge-warn {{
      background: rgba(255,209,102,0.12);
      color: var(--warn);
    }}
    .node-detail {{
      color: var(--muted);
      line-height: 1.65;
      font-size: 14px;
    }}
    @media (max-width: 720px) {{
      .wrap {{ padding-inline: 14px; }}
      .node-head {{ flex-direction: column; }}
      .node-order {{ align-items: start; }}
      .progress-step {{ flex-direction: column; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Cluster-external observer</div>
      <h1>Lab Observer</h1>
      <p>这台页面运行在 <strong>{escape(observer_host)}</strong>，不在 `lab-ha` 集群里。它负责在整套开关机前后持续给你一个不掉线的外部视角：节点是否可达、固定入口是否恢复，以及集群内 Portal live 状态是否已经接管。</p>
      <div class="hero-meta">
        <span class="chip">当前时间 {escape(checked_at)}</span>
        <span class="chip">自动刷新 {REFRESH_SECONDS}s</span>
        <span class="chip">推荐文档仍以 VM_POWER_SEQUENCE.md 为准</span>
      </div>
    </section>

    <div class="grid-two">
      {render_state_card("外置开机观察", "boot", snapshot["boot"], "http://192.168.0.108:30088", "打开集群内 Portal")}
      {render_state_card("外置关机观察", "shutdown", snapshot["shutdown"], POWER_SEQUENCE_URL, "打开开关机顺序")}
    </div>

    <section class="card">
      <div class="eyebrow">External signals</div>
      <h2>关键探针</h2>
      <div class="mini-grid">
        {render_signal_cards(snapshot["signals"])}
      </div>
      <p class="detail">当集群内 Portal live API 可用时，这张外置页会直接镜像它的开关机状态；当 Portal 本身还没起来，或已经跟着 node2 一起下线时，就自动退回到外部探针视角。</p>
      <div class="actions">
        <a href="{escape(POWER_SEQUENCE_URL)}" target="_blank" rel="noreferrer">打开 VM_POWER_SEQUENCE.md</a>
        <a href="{escape(RECOVERY_RUNBOOK_URL)}" target="_blank" rel="noreferrer">打开 RECOVERY_RUNBOOK.md</a>
      </div>
    </section>

    <section class="card">
      <div class="eyebrow">Nodes</div>
      <h2>节点与顺序理由</h2>
      <div class="nodes">
        {render_nodes(snapshot["nodes"])}
      </div>
    </section>
  </div>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    server_version = "LabObserver/1.0"

    def log_message(self, fmt, *args):
        return

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, body, status=HTTPStatus.OK):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_text(self, body, status=HTTPStatus.OK):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/healthz", "/readyz"):
            self._send_text("ok\n")
            return
        if self.path == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        snapshot = collect_snapshot()
        if self.path == "/api/status":
            self._send_json(snapshot)
            return
        if self.path == "/":
            self._send_html(render_html(snapshot))
            return
        self._send_json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)


def main():
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
