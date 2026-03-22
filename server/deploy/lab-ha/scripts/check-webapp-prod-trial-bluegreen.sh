#!/usr/bin/env bash
set -euo pipefail

# 蓝绿校验默认直接走 NodePort + Host 头，避免本机 DNS / nip.io / VPN 路由差异把发布验证搞成假失败。
HOST_HEADER_ACTIVE="${HOST_HEADER_ACTIVE:-webapp-trial.192.168.0.108.nip.io}"
HOST_HEADER_PREVIEW="${HOST_HEADER_PREVIEW:-webapp-trial-preview.192.168.0.108.nip.io}"
NODE_PORT="${NODE_PORT:-32668}"
PATH_SUFFIX="${PATH_SUFFIX:-/readyz}"

if [[ "$#" -gt 0 ]]; then
  NODES=("$@")
else
  NODES=("192.168.0.7" "192.168.0.108" "192.168.0.128")
fi

TMP_OUTPUT="$(mktemp)"
FAILURES=0

check_slot() {
  local slot_name="$1"
  local host_header="$2"

  printf '\n[%s] host=%s path=%s port=%s\n' "$slot_name" "$host_header" "$PATH_SUFFIX" "$NODE_PORT"

  local node=""
  for node in "${NODES[@]}"; do
    local code
    code="$(
      curl --noproxy '*' \
        -m 5 \
        -sS \
        -o "$TMP_OUTPUT" \
        -w '%{http_code}' \
        -H "Host: ${host_header}" \
        "http://${node}:${NODE_PORT}${PATH_SUFFIX}" || printf 'ERR'
    )"

    if [[ "$code" == "200" ]]; then
      printf '[OK]   %s -> %s\n' "$node" "$code"
      continue
    fi

    FAILURES=$((FAILURES + 1))
    local body
    body="$(tr '\n' ' ' <"$TMP_OUTPUT" 2>/dev/null | cut -c1-120)"
    printf '[FAIL] %s -> %s %s\n' "$node" "$code" "$body"
  done
}

trap 'rm -f "$TMP_OUTPUT"' EXIT

check_slot "active" "$HOST_HEADER_ACTIVE"
check_slot "preview" "$HOST_HEADER_PREVIEW"

if [[ "$FAILURES" -gt 0 ]]; then
  printf '\nDetected %s failing endpoint(s).\n' "$FAILURES" >&2
  exit 1
fi

printf '\nActive and preview endpoints are healthy.\n'
