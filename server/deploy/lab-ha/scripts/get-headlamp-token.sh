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

TOKEN_DURATION_DISPLAY="$TOKEN_DURATION"
TOKEN_DURATION_KUBECTL="$TOKEN_DURATION"
if [[ "$TOKEN_DURATION" =~ ^([0-9]+)d$ ]]; then
  TOKEN_DURATION_KUBECTL="$((BASH_REMATCH[1] * 24))h"
fi

# Headlamp 官方推荐使用 Kubernetes token 登录；这里把实验室固定入口一起打印出来，减少值班时手抄参数出错。
token="$(kubectl --kubeconfig "$KUBECONFIG" create token "$SERVICE_ACCOUNT" -n "$NAMESPACE" --duration="$TOKEN_DURATION_KUBECTL")"

printf 'Headlamp URL: http://%s:%s\n' "$ACCESS_HOST" "$ACCESS_PORT"
printf 'ServiceAccount: %s/%s\n' "$NAMESPACE" "$SERVICE_ACCOUNT"
printf 'Token duration: %s\n' "$TOKEN_DURATION_DISPLAY"
printf '\n%s\n' "$token"
