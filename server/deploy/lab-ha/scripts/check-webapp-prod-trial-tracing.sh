#!/usr/bin/env bash
set -euo pipefail

WEBAPP_NODE_IP="${WEBAPP_NODE_IP:-192.168.0.108}"
WEBAPP_NODE_PORT="${WEBAPP_NODE_PORT:-30089}"
JAEGER_NODE_IP="${JAEGER_NODE_IP:-192.168.0.108}"
JAEGER_NODE_PORT="${JAEGER_NODE_PORT:-30686}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-20}"

deadline=$((SECONDS + TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  curl --noproxy '*' --fail --silent --show-error \
    "http://${WEBAPP_NODE_IP}:${WEBAPP_NODE_PORT}/readyz" >/dev/null
  if curl --noproxy '*' --fail --silent --show-error \
    "http://${JAEGER_NODE_IP}:${JAEGER_NODE_PORT}/api/services" \
    | grep -q 'webapp-template.service'; then
    echo ">>> jaeger contains service webapp-template.service"
    exit 0
  fi
  sleep 2
done

echo "ERROR: jaeger did not report webapp-template.service within ${TIMEOUT_SECONDS}s" >&2
exit 1
