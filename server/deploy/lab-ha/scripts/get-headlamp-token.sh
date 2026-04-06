#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
NAMESPACE="${NAMESPACE:-headlamp}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-headlamp-admin}"
TOKEN_DURATION="${TOKEN_DURATION:-90d}"
ACCESS_HOST="${ACCESS_HOST:-192.168.0.108}"
ACCESS_PORT="${ACCESS_PORT:-30087}"

if ! command -v kubectl >/dev/null 2>&1; then
  printf 'missing required tool: kubectl\n' >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  printf 'missing required tool: python3\n' >&2
  exit 1
fi

read -r TOKEN_DURATION_DISPLAY TOKEN_DURATION_KUBECTL < <(
  python3 - <<'PY' "$TOKEN_DURATION"
import datetime
import sys

value = sys.argv[1].strip()
if not value:
    raise SystemExit("TOKEN_DURATION must not be empty")

if value.endswith("y"):
    years = int(value[:-1])
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    try:
        target = now.replace(year=now.year + years)
    except ValueError:
        # 兼容 2 月 29 日这类日期，按月底自然收口到 2 月 28 日同一时刻。
        target = now.replace(month=2, day=28, year=now.year + years)
    hours = int((target - now).total_seconds() // 3600)
    print(value, f"{hours}h")
elif value.endswith("d"):
    days = int(value[:-1])
    print(value, f"{days * 24}h")
else:
    print(value, value)
PY
)

# Headlamp 官方推荐使用 Kubernetes token 登录；这里把实验室固定入口一起打印出来，减少值班时手抄参数出错。
token="$(kubectl --kubeconfig "$KUBECONFIG" create token "$SERVICE_ACCOUNT" -n "$NAMESPACE" --duration="$TOKEN_DURATION_KUBECTL")"

printf 'Headlamp URL: http://%s:%s\n' "$ACCESS_HOST" "$ACCESS_PORT"
printf 'ServiceAccount: %s/%s\n' "$NAMESPACE" "$SERVICE_ACCOUNT"
printf 'Token duration: %s\n' "$TOKEN_DURATION_DISPLAY"
printf '\n%s\n' "$token"
