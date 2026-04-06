#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
HEADLAMP_NAMESPACE="${HEADLAMP_NAMESPACE:-headlamp}"
HEADLAMP_SERVICE_ACCOUNT="${HEADLAMP_SERVICE_ACCOUNT:-headlamp-admin}"
PORTAL_NAMESPACE="${PORTAL_NAMESPACE:-lab-portal}"
PORTAL_SECRET="${PORTAL_SECRET:-lab-portal-headlamp-access}"
PORTAL_DEPLOYMENT="${PORTAL_DEPLOYMENT:-lab-portal}"
TOKEN_DURATION="${TOKEN_DURATION:-10y}"
ACCESS_HOST="${ACCESS_HOST:-192.168.0.108}"
ACCESS_PORT="${ACCESS_PORT:-30087}"
RESTART_PORTAL="${RESTART_PORTAL:-1}"

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
        # 兼容 2 月 29 日，按自然年收口到 2 月 28 日同一时刻。
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

tmp_json="$(mktemp)"
cleanup() {
  rm -f "$tmp_json"
}
trap cleanup EXIT

# 这里显式生成一个长时效 token，再通过 Portal runtime Secret 暴露给值班页，避免把明文写进 git 真源。
token="$(kubectl --kubeconfig "$KUBECONFIG" create token "$HEADLAMP_SERVICE_ACCOUNT" -n "$HEADLAMP_NAMESPACE" --duration="$TOKEN_DURATION_KUBECTL")"

python3 - <<'PY' "$tmp_json" "$token" "$ACCESS_HOST" "$ACCESS_PORT" "$HEADLAMP_NAMESPACE" "$HEADLAMP_SERVICE_ACCOUNT" "$TOKEN_DURATION_DISPLAY"
import base64
import datetime
import json
import sys

output_path, token, access_host, access_port, namespace, service_account, duration_display = sys.argv[1:]
parts = token.split(".")
if len(parts) < 2:
    raise SystemExit("unexpected service account token format")
payload = parts[1] + "=" * (-len(parts[1]) % 4)
claims = json.loads(base64.urlsafe_b64decode(payload))

issued_at = datetime.datetime.fromtimestamp(claims["iat"], datetime.timezone.utc).isoformat()
expires_at = datetime.datetime.fromtimestamp(claims["exp"], datetime.timezone.utc).isoformat()

data = {
    "headlampUrl": f"http://{access_host}:{access_port}",
    "namespace": namespace,
    "serviceAccount": f"{namespace}/{service_account}",
    "duration": duration_display,
    "issuedAt": issued_at,
    "expiresAt": expires_at,
    "token": token,
}

with open(output_path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
PY

kubectl --kubeconfig "$KUBECONFIG" -n "$PORTAL_NAMESPACE" \
  create secret generic "$PORTAL_SECRET" \
  --from-file=headlamp-access.json="$tmp_json" \
  --dry-run=client -o yaml | kubectl --kubeconfig "$KUBECONFIG" apply -f -

if [[ "$RESTART_PORTAL" == "1" ]]; then
  # Portal 当前只有 1 副本；这里主动重启一次，让新 token 立即对外生效，而不是等 volume refresh 周期。
  kubectl --kubeconfig "$KUBECONFIG" -n "$PORTAL_NAMESPACE" rollout restart "deployment/$PORTAL_DEPLOYMENT" >/dev/null
  kubectl --kubeconfig "$KUBECONFIG" -n "$PORTAL_NAMESPACE" rollout status "deployment/$PORTAL_DEPLOYMENT" --timeout=180s >/dev/null
fi

expires_at="$(
  python3 - <<'PY' "$tmp_json"
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = json.load(fh)
print(data["expiresAt"])
PY
)"

printf 'Portal URL: http://%s:30088\n' "$ACCESS_HOST"
printf 'Headlamp URL: http://%s:%s\n' "$ACCESS_HOST" "$ACCESS_PORT"
printf 'Portal secret: %s/%s\n' "$PORTAL_NAMESPACE" "$PORTAL_SECRET"
printf 'ServiceAccount: %s/%s\n' "$HEADLAMP_NAMESPACE" "$HEADLAMP_SERVICE_ACCOUNT"
printf 'Token duration: %s\n' "$TOKEN_DURATION_DISPLAY"
printf 'Token expires at: %s\n' "$expires_at"
