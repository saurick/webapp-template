#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 蓝绿校验默认直接走正式 Gateway 端口，避免继续依赖旧 Ingress Host 头路由。
ACTIVE_PORT="${ACTIVE_PORT:-30089}"
PREVIEW_PORT="${PREVIEW_PORT:-30091}"
PATH_SUFFIX="${PATH_SUFFIX:-/readyz}"
SUMMARY_HELPER="${SCRIPT_DIR}/write-lab-ops-summary.sh"

if [[ "$#" -gt 0 ]]; then
  NODES=("$@")
else
  NODES=("192.168.0.7" "192.168.0.108" "192.168.0.128")
fi

TMP_OUTPUT="$(mktemp)"
FAILURES=0
TOTAL_CHECKS=0
PASSED_CHECKS=0

persist_summary() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'WARN: jq not found, skip portal smoke summary update\n' >&2
    return 0
  fi

  local status summary detail
  status="ok"
  if [[ "$FAILURES" -gt 0 ]]; then
    status="fail"
  fi
  summary="active+preview ${PASSED_CHECKS}/${TOTAL_CHECKS} ok · path ${PATH_SUFFIX} · ports ${ACTIVE_PORT}/${PREVIEW_PORT}"
  detail="nodes ${#NODES[@]} · active port ${ACTIVE_PORT} · preview port ${PREVIEW_PORT}"

  jq -n \
    --arg kind "smoke" \
    --arg status "$status" \
    --arg checked_at "$(date -u +%FT%TZ)" \
    --arg summary "$summary" \
    --arg detail "$detail" \
    --arg active_port "$ACTIVE_PORT" \
    --arg preview_port "$PREVIEW_PORT" \
    --arg path_suffix "$PATH_SUFFIX" \
    --arg passed_checks "$PASSED_CHECKS" \
    --arg total_checks "$TOTAL_CHECKS" \
    '{
      kind: $kind,
      status: $status,
      checked_at: $checked_at,
      summary: $summary,
      detail: $detail,
      metrics: {
        active_port: $active_port,
        preview_port: $preview_port,
        path_suffix: $path_suffix,
        passed_checks: $passed_checks,
        total_checks: $total_checks
      }
    }' | bash "$SUMMARY_HELPER" smoke >/dev/null || true
}

check_slot() {
  local slot_name="$1"
  local port="$2"

  printf '\n[%s] path=%s port=%s\n' "$slot_name" "$PATH_SUFFIX" "$port"

  local node=""
  for node in "${NODES[@]}"; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    local code
    code="$(
      curl --noproxy '*' \
        -m 5 \
        -sS \
        -o "$TMP_OUTPUT" \
        -w '%{http_code}' \
        "http://${node}:${port}${PATH_SUFFIX}" || printf 'ERR'
    )"

    if [[ "$code" == "200" ]]; then
      PASSED_CHECKS=$((PASSED_CHECKS + 1))
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

check_slot "active" "$ACTIVE_PORT"
check_slot "preview" "$PREVIEW_PORT"
persist_summary

if [[ "$FAILURES" -gt 0 ]]; then
  printf '\nDetected %s failing endpoint(s).\n' "$FAILURES" >&2
  exit 1
fi

printf '\nActive and preview endpoints are healthy.\n'
