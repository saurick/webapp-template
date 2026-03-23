#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
VELERO_NAMESPACE="${VELERO_NAMESPACE:-velero}"
SCHEDULE_NAME="${SCHEDULE_NAME:-webapp-daily}"
BSL_NAME="${BSL_NAME:-default}"
SUMMARY_HELPER="${SCRIPT_DIR}/write-lab-ops-summary.sh"

failures=()
BSL_PHASE="unknown"
SCHEDULE_PAUSED="unknown"
SCHEDULE_LAST_BACKUP=""
LATEST_BACKUP_NAME=""
LATEST_BACKUP_PHASE="unknown"
LATEST_BACKUP_CREATED=""

record_failure() {
  failures+=("$1")
  printf 'FAIL: %s\n' "$1" >&2
}

persist_summary() {
  if ! command -v jq >/dev/null 2>&1; then
    printf 'WARN: jq not found, skip portal backup summary update\n' >&2
    return 0
  fi

  local status summary detail
  status="ok"
  if [[ ${#failures[@]} -gt 0 ]]; then
    status="fail"
  fi
  summary="bsl ${BSL_PHASE} · schedule ${SCHEDULE_NAME} paused=${SCHEDULE_PAUSED} · latest ${LATEST_BACKUP_PHASE}"
  detail="backup ${LATEST_BACKUP_NAME:-none} · created ${LATEST_BACKUP_CREATED:-n/a} · lastBackup ${SCHEDULE_LAST_BACKUP:-n/a}"
  if [[ ${#failures[@]} -gt 0 ]]; then
    detail="${detail} · issues $(printf '%s; ' "${failures[@]}")"
    detail="${detail%; }"
  fi

  jq -n \
    --arg kind "backup" \
    --arg status "$status" \
    --arg checked_at "$(date -u +%FT%TZ)" \
    --arg summary "$summary" \
    --arg detail "$detail" \
    --arg bsl_phase "$BSL_PHASE" \
    --arg schedule_name "$SCHEDULE_NAME" \
    --arg schedule_paused "$SCHEDULE_PAUSED" \
    --arg schedule_last_backup "$SCHEDULE_LAST_BACKUP" \
    --arg latest_backup_name "$LATEST_BACKUP_NAME" \
    --arg latest_backup_phase "$LATEST_BACKUP_PHASE" \
    --arg latest_backup_created "$LATEST_BACKUP_CREATED" \
    '{
      kind: $kind,
      status: $status,
      checked_at: $checked_at,
      summary: $summary,
      detail: $detail,
      metrics: {
        bsl_phase: $bsl_phase,
        schedule_name: $schedule_name,
        schedule_paused: $schedule_paused,
        schedule_last_backup: $schedule_last_backup,
        latest_backup_name: $latest_backup_name,
        latest_backup_phase: $latest_backup_phase,
        latest_backup_created: $latest_backup_created
      }
    }' | bash "$SUMMARY_HELPER" backup >/dev/null || true
}

printf '== velero backup ==\n'

if ! command -v jq >/dev/null 2>&1; then
  echo 'missing required tool: jq' >&2
  exit 1
fi

bsl_json="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get backupstoragelocation -n "$VELERO_NAMESPACE" "$BSL_NAME" -o json 2>/dev/null || true)"
if [[ -z "$bsl_json" ]]; then
  record_failure "backup storage location ${BSL_NAME} not found"
else
  BSL_PHASE="$(printf '%s' "$bsl_json" | jq -r '.status.phase // "unknown"')"
  printf 'bsl=%s phase=%s\n' "$BSL_NAME" "$BSL_PHASE"
  [[ "$BSL_PHASE" == "Available" ]] || record_failure "backup storage location ${BSL_NAME} is ${BSL_PHASE}"
fi

schedule_json="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get schedules.velero.io -n "$VELERO_NAMESPACE" "$SCHEDULE_NAME" -o json 2>/dev/null || true)"
if [[ -z "$schedule_json" ]]; then
  record_failure "schedule ${SCHEDULE_NAME} not found"
else
  SCHEDULE_PAUSED="$(printf '%s' "$schedule_json" | jq -r '(.spec.paused // false) | tostring')"
  SCHEDULE_LAST_BACKUP="$(printf '%s' "$schedule_json" | jq -r '.status.lastBackup // ""')"
  printf 'schedule=%s paused=%s lastBackup=%s\n' "$SCHEDULE_NAME" "$SCHEDULE_PAUSED" "${SCHEDULE_LAST_BACKUP:-n/a}"
  [[ "$SCHEDULE_PAUSED" == "false" ]] || record_failure "schedule ${SCHEDULE_NAME} is paused"
fi

latest_backup_json="$(
  kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get backups.velero.io -n "$VELERO_NAMESPACE" -o json \
    | jq -c --arg schedule "$SCHEDULE_NAME" '
        [(.items // [])[] | select((.metadata.labels["velero.io/schedule-name"] // "") == $schedule)]
        | sort_by(.metadata.creationTimestamp)
        | last // {}
      ' 2>/dev/null || true
)"

if [[ -z "$latest_backup_json" || "$latest_backup_json" == "{}" ]]; then
  record_failure "no backup found for schedule ${SCHEDULE_NAME}"
else
  LATEST_BACKUP_NAME="$(printf '%s' "$latest_backup_json" | jq -r '.metadata.name // ""')"
  LATEST_BACKUP_PHASE="$(printf '%s' "$latest_backup_json" | jq -r '.status.phase // "unknown"')"
  LATEST_BACKUP_CREATED="$(printf '%s' "$latest_backup_json" | jq -r '.metadata.creationTimestamp // ""')"
  printf 'latest_backup=%s phase=%s created=%s\n' "$LATEST_BACKUP_NAME" "$LATEST_BACKUP_PHASE" "${LATEST_BACKUP_CREATED:-n/a}"
  [[ "$LATEST_BACKUP_PHASE" == "Completed" ]] || record_failure "latest backup ${LATEST_BACKUP_NAME} is ${LATEST_BACKUP_PHASE}"
fi

persist_summary

if [[ ${#failures[@]} -gt 0 ]]; then
  printf '\nBackup check failed with %d issue(s):\n' "${#failures[@]}" >&2
  for item in "${failures[@]}"; do
    printf -- '- %s\n' "$item" >&2
  done
  exit 1
fi

printf '\nBackup check passed.\n'
