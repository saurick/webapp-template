#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
SUMMARY_NAMESPACE="${SUMMARY_NAMESPACE:-monitoring}"
SUMMARY_SELECTOR="${SUMMARY_SELECTOR:-app=alert-webhook-receiver}"
SUMMARY_KEY="${1:-}"

if [[ -z "$SUMMARY_KEY" ]]; then
  echo "usage: bash write-lab-ops-summary.sh <summary-key>" >&2
  exit 1
fi

if [[ ! "$SUMMARY_KEY" =~ ^[a-z0-9-]+$ ]]; then
  echo "invalid summary key: $SUMMARY_KEY" >&2
  exit 1
fi

tmp_file="$(mktemp)"
trap 'rm -f "$tmp_file"' EXIT
cat >"$tmp_file"

# 运维摘要只有几 KB，直接复用 Alert Sink 已持久化的 PVC，避免再引入一套数据库或新服务。
pod_name="$(
  kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" \
    get pod -n "$SUMMARY_NAMESPACE" \
    -l "$SUMMARY_SELECTOR" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true
)"

if [[ -z "$pod_name" ]]; then
  echo "WARN: skip persisting ops summary '$SUMMARY_KEY': alert sink pod not running" >&2
  exit 0
fi

payload_b64="$(base64 <"$tmp_file" | tr -d '\n')"

# 这里不再依赖 kubectl exec 的 stdin 直灌；当前环境里那条链路会偶发写出空文件，直接导致 Portal 摘要变成空白。
if ! kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" exec -n "$SUMMARY_NAMESPACE" "$pod_name" -- \
  sh -c "mkdir -p /data/ops-state && printf '%s' '$payload_b64' | base64 -d > /data/ops-state/${SUMMARY_KEY}.json"; then
  echo "WARN: failed to persist ops summary '$SUMMARY_KEY'" >&2
  exit 0
fi

echo "Persisted ops summary '$SUMMARY_KEY' via $pod_name" >&2
