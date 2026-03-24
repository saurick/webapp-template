#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
CHECK_SCRIPT="${SCRIPT_DIR}/check-ha-lab-cold-start.sh"
SUMMARY_HELPER="${SCRIPT_DIR}/write-lab-ops-summary.sh"
SCENARIO_KEY="${1:-simultaneous-reboot}"

scenario_label() {
  case "$1" in
    simultaneous-reboot)
      printf 'simultaneous reboot'
      ;;
    rolling-reboot)
      printf 'rolling reboot'
      ;;
    single-node-reboot)
      printf 'single-node reboot'
      ;;
    *)
      printf '%s' "$1" | tr '-' ' '
      ;;
  esac
}

SCENARIO_LABEL="$(scenario_label "$SCENARIO_KEY")"

persist_summary() {
  local status="$1"
  local summary="$2"
  local detail="$3"
  local ready_nodes="$4"
  local total_nodes="$5"
  local schedulable_nodes="$6"
  local access_ok="$7"
  local access_total="$8"
  local argo_sync="$9"
  local argo_health="${10}"
  local bsl_phase="${11}"

  if ! command -v jq >/dev/null 2>&1; then
    printf 'WARN: jq not found, skip portal HA drill summary update\n' >&2
    return 0
  fi

  jq -n \
    --arg kind "ha-drill" \
    --arg scenario "$SCENARIO_KEY" \
    --arg status "$status" \
    --arg checked_at "$(date -u +%FT%TZ)" \
    --arg summary "$summary" \
    --arg detail "$detail" \
    --arg ready_nodes "$ready_nodes" \
    --arg total_nodes "$total_nodes" \
    --arg schedulable_nodes "$schedulable_nodes" \
    --arg access_ok "$access_ok" \
    --arg access_total "$access_total" \
    --arg argo_sync "$argo_sync" \
    --arg argo_health "$argo_health" \
    --arg bsl_phase "$bsl_phase" \
    '{
      kind: $kind,
      scenario: $scenario,
      status: $status,
      checked_at: $checked_at,
      summary: $summary,
      detail: $detail,
      metrics: {
        ready_nodes: $ready_nodes,
        total_nodes: $total_nodes,
        schedulable_nodes: $schedulable_nodes,
        access_ok: $access_ok,
        access_total: $access_total,
        argo_sync: $argo_sync,
        argo_health: $argo_health,
        bsl_phase: $bsl_phase
      }
    }' | bash "$SUMMARY_HELPER" ha-drill >/dev/null || true
}

if ! bash "$CHECK_SCRIPT"; then
  persist_summary \
    "fail" \
    "${SCENARIO_LABEL} · cold-start verification failed" \
    "see check-ha-lab-cold-start.sh output and RECOVERY_RUNBOOK.md" \
    "0" "0" "0" "0" "6" "unknown" "unknown" "unknown"
  exit 1
fi

nodes_json="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes -o json)"
ready_nodes="$(printf '%s' "$nodes_json" | jq '[.items[] | select(any(.status.conditions[]?; .type=="Ready" and .status=="True"))] | length')"
total_nodes="$(printf '%s' "$nodes_json" | jq '.items | length')"

longhorn_nodes_json="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes.longhorn.io -n longhorn-system -o json)"
schedulable_nodes="$(
  printf '%s' "$longhorn_nodes_json" | jq '[.items[] | (.status.diskStatus // {} | to_entries[]) | (.value.conditions // [])[] | select(.type == "Schedulable" and .status == "True")] | length'
)"

argo_sync="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get application -n argocd webapp-template-lab -o jsonpath='{.status.sync.status}' 2>/dev/null || printf 'unknown')"
argo_health="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get application -n argocd webapp-template-lab -o jsonpath='{.status.health.status}' 2>/dev/null || printf 'unknown')"
bsl_phase="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get backupstoragelocation -n velero default -o jsonpath='{.status.phase}' 2>/dev/null || printf 'unknown')"

summary="${SCENARIO_LABEL} · nodes ${ready_nodes}/${total_nodes} · urls 6/6 · longhorn ${schedulable_nodes} schedulable"
detail="argo ${argo_sync}/${argo_health} · bsl ${bsl_phase} · recovery acceptance passed"

persist_summary \
  "ok" \
  "$summary" \
  "$detail" \
  "$ready_nodes" \
  "$total_nodes" \
  "$schedulable_nodes" \
  "6" \
  "6" \
  "$argo_sync" \
  "$argo_health" \
  "$bsl_phase"

printf 'HA drill verification passed for %s.\n' "$SCENARIO_KEY"
