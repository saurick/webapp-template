#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

usage() {
	cat <<'EOF'
用法：
  bash scripts/loadtest/run.sh [health|system|auth|mixed] [k6 args...]

常用环境变量：
  BASE_URL=http://127.0.0.1:8200
  LOADTEST_HOST_HEADER=webapp-trial.lab.home.arpa
  LOADTEST_AUTH_MODE=register|login
  LOADTEST_USERNAME=alice
  LOADTEST_PASSWORD=Passw0rd!123
  LOADTEST_RUN_ID=lt-20260321-demo
  K6_WEB_DASHBOARD=true
EOF
}

rewrite_localhost_for_docker() {
	local value="$1"
	value="${value/http:\/\/127.0.0.1/http:\/\/host.docker.internal}"
	value="${value/https:\/\/127.0.0.1/https:\/\/host.docker.internal}"
	value="${value/http:\/\/localhost/http:\/\/host.docker.internal}"
	value="${value/https:\/\/localhost/https:\/\/host.docker.internal}"
	printf '%s' "$value"
}

scenario="${1:-mixed}"
case "${scenario}" in
health | system | auth | mixed) ;;
-h | --help)
	usage
	exit 0
	;;
*)
	printf '未知压测场景: %s\n' "${scenario}" >&2
	usage >&2
	exit 1
	;;
esac

if [[ $# -gt 0 ]]; then
	shift
fi
extra_args=("$@")

base_url="${BASE_URL:-http://127.0.0.1:8200}"
loadtest_run_id="${LOADTEST_RUN_ID:-lt-$(date +%Y%m%d-%H%M%S)}"
output_dir="${REPO_ROOT}/server/deploy/lab-ha/artifacts/loadtest/${loadtest_run_id}"
summary_path_host="${output_dir}/summary.json"
dashboard_path_host="${output_dir}/report.html"
meta_path_host="${output_dir}/meta.env"
script_path_host="${SCRIPT_DIR}/${scenario}.js"
script_path_container="/workspace/scripts/loadtest/${scenario}.js"

k6_dashboard="${K6_WEB_DASHBOARD:-true}"
k6_dashboard_open="${K6_WEB_DASHBOARD_OPEN:-false}"
k6_dashboard_port="${K6_WEB_DASHBOARD_PORT:-5665}"
k6_image="${LOADTEST_K6_IMAGE:-grafana/k6:latest}"
dashboard_flag="$(printf '%s' "${k6_dashboard}" | tr '[:upper:]' '[:lower:]')"

mkdir -p "${output_dir}"

cat >"${meta_path_host}" <<EOF
SCENARIO=${scenario}
BASE_URL=${base_url}
LOADTEST_RUN_ID=${loadtest_run_id}
LOADTEST_HOST_HEADER=${LOADTEST_HOST_HEADER:-}
LOADTEST_AUTH_MODE=${LOADTEST_AUTH_MODE:-}
LOADTEST_USERNAME=${LOADTEST_USERNAME:-}
K6_WEB_DASHBOARD=${k6_dashboard}
K6_WEB_DASHBOARD_PORT=${k6_dashboard_port}
EOF

printf 'loadtest scenario=%s\n' "${scenario}"
printf 'loadtest run_id=%s\n' "${loadtest_run_id}"
printf 'loadtest output=%s\n' "${output_dir}"

if command -v k6 >/dev/null 2>&1; then
	export BASE_URL="${base_url}"
	export LOADTEST_RUN_ID="${loadtest_run_id}"
	export K6_WEB_DASHBOARD="${k6_dashboard}"
	export K6_WEB_DASHBOARD_OPEN="${k6_dashboard_open}"
	export K6_WEB_DASHBOARD_PORT="${k6_dashboard_port}"
	export K6_WEB_DASHBOARD_EXPORT="${K6_WEB_DASHBOARD_EXPORT:-${dashboard_path_host}}"

	k6 run --summary-export "${summary_path_host}" "${extra_args[@]}" "${script_path_host}"
else
	# Docker fallback 需要把 localhost 改成 host.docker.internal，避免容器内回环到自己。
	docker_base_url="$(rewrite_localhost_for_docker "${base_url}")"
	docker_args=(
		--rm
		-i
		-v "${REPO_ROOT}:/workspace"
		-v "${output_dir}:/artifacts"
		-w /workspace
	)

	if [[ "${docker_base_url}" != "${base_url}" ]]; then
		printf 'docker fallback rewrite BASE_URL: %s -> %s\n' "${base_url}" "${docker_base_url}"
	fi
	case "${dashboard_flag}" in
	1 | true | yes | on)
		docker_args=(-p "${k6_dashboard_port}:${k6_dashboard_port}" "${docker_args[@]}")
		;;
	esac

	docker run "${docker_args[@]}" \
		-e BASE_URL="${docker_base_url}" \
		-e LOADTEST_RUN_ID="${loadtest_run_id}" \
		-e LOADTEST_HOST_HEADER="${LOADTEST_HOST_HEADER:-}" \
		-e LOADTEST_USER_AGENT="${LOADTEST_USER_AGENT:-}" \
		-e LOADTEST_AUTH_MODE="${LOADTEST_AUTH_MODE:-}" \
		-e LOADTEST_USERNAME="${LOADTEST_USERNAME:-}" \
		-e LOADTEST_PASSWORD="${LOADTEST_PASSWORD:-}" \
		-e LOADTEST_AUTH_URL="${LOADTEST_AUTH_URL:-}" \
		-e LOADTEST_SYSTEM_URL="${LOADTEST_SYSTEM_URL:-}" \
		-e LOADTEST_THINK_TIME_MS="${LOADTEST_THINK_TIME_MS:-}" \
		-e LOADTEST_LOGOUT_AFTER_AUTH="${LOADTEST_LOGOUT_AFTER_AUTH:-}" \
		-e K6_WEB_DASHBOARD="${k6_dashboard}" \
		-e K6_WEB_DASHBOARD_OPEN="${k6_dashboard_open}" \
		-e K6_WEB_DASHBOARD_PORT="${k6_dashboard_port}" \
		-e K6_WEB_DASHBOARD_EXPORT="/artifacts/report.html" \
		"${k6_image}" \
		run --summary-export /artifacts/summary.json "${extra_args[@]}" "${script_path_container}"
fi

printf 'summary json: %s\n' "${summary_path_host}"
printf 'dashboard html: %s\n' "${dashboard_path_host}"
