#!/usr/bin/env bash
set -euo pipefail

GITLAB_HOST="${GITLAB_HOST:-root@192.168.0.108}"
RESTART_PUMA="${RESTART_PUMA:-0}"
SSH_ARGS=(-o StrictHostKeyChecking=no)

UPDATE_SQL="$(cat <<'SQL'
update application_settings
set signup_enabled = false,
    usage_ping_enabled = false,
    usage_ping_features_enabled = false,
    usage_ping_generation_enabled = false,
    version_check_enabled = false,
    include_optional_metrics_in_service_ping = false,
    service_ping_settings = jsonb_set(
      jsonb_set(
        coalesce(service_ping_settings, '{}'::jsonb),
        '{gitlab_product_usage_data_enabled}',
        'false'::jsonb,
        true
      ),
      '{gitlab_environment_toolkit_instance}',
      'false'::jsonb,
      true
    )
where id = (select max(id) from application_settings);
SQL
)"

VERIFY_SQL="$(cat <<'SQL'
select signup_enabled,
       usage_ping_enabled,
       usage_ping_features_enabled,
       usage_ping_generation_enabled,
       version_check_enabled,
       include_optional_metrics_in_service_ping,
       service_ping_settings
from application_settings
order by id desc
limit 1;
SQL
)"

run_ssh() {
  ssh "${SSH_ARGS[@]}" "$GITLAB_HOST" "$@"
}

echo "[gitlab] applying hardening baseline on ${GITLAB_HOST}"
run_ssh "gitlab-psql -d gitlabhq_production -v ON_ERROR_STOP=1 -c $(printf '%q' "$UPDATE_SQL")"

if [[ "$RESTART_PUMA" == "1" ]]; then
  # 只在确认需要刷新应用设置缓存时显式开启，避免把日常脚本变成默认重启动作。
  echo "[gitlab] restarting puma to flush cached application settings"
  run_ssh "gitlab-ctl restart puma >/dev/null && gitlab-ctl status puma"
fi

echo "[gitlab] verifying persisted settings"
run_ssh "gitlab-psql -d gitlabhq_production -c $(printf '%q' "$VERIFY_SQL")"
