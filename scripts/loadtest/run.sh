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
  LOADTEST_PROMETHEUS_RW_URL=http://192.168.0.108:30090/api/v1/write
  LOADTEST_K6_DOWNLOAD_URL=https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz
  K6_WEB_DASHBOARD=true
EOF
}

apply_k6_flag_overrides() {
	local args=("$@")
	local index=0
	local current

	while ((index < ${#args[@]})); do
		current="${args[index]}"
		case "${current}" in
		--vus=*)
			export LOADTEST_VUS="${current#*=}"
			;;
		--vus)
			if ((index + 1 < ${#args[@]})); then
				index=$((index + 1))
				export LOADTEST_VUS="${args[index]}"
			fi
			;;
		--duration=*)
			export LOADTEST_DURATION="${current#*=}"
			;;
		--duration)
			if ((index + 1 < ${#args[@]})); then
				index=$((index + 1))
				export LOADTEST_DURATION="${args[index]}"
			fi
			;;
		--iterations=*)
			export LOADTEST_ITERATIONS="${current#*=}"
			;;
		--iterations)
			if ((index + 1 < ${#args[@]})); then
				index=$((index + 1))
				export LOADTEST_ITERATIONS="${args[index]}"
			fi
			;;
		esac
		index=$((index + 1))
	done
}

rewrite_localhost_for_docker() {
	local value="$1"
	value="${value/http:\/\/127.0.0.1/http:\/\/host.docker.internal}"
	value="${value/https:\/\/127.0.0.1/https:\/\/host.docker.internal}"
	value="${value/http:\/\/localhost/http:\/\/host.docker.internal}"
	value="${value/https:\/\/localhost/https:\/\/host.docker.internal}"
	printf '%s' "$value"
}

ensure_go_k6_binary() {
	local go_bin_dir="${LOADTEST_GO_K6_BIN_DIR:-${REPO_ROOT}/.cache/loadtest/bin}"
	local go_k6_bin="${go_bin_dir}/k6"
	local go_k6_version="${LOADTEST_GO_K6_VERSION:-v0.49.0}"

	if ! command -v go >/dev/null 2>&1; then
		return 1
	fi
	if [[ -x "${go_k6_bin}" ]]; then
		printf '%s' "${go_k6_bin}"
		return 0
	fi

	# go-install 仅作为本地临时机/一次性环境的兜底，不是 GitLab shell runner 的推荐基线。
	mkdir -p "${go_bin_dir}"
	printf 'install k6 via go: %s -> %s\n' "${go_k6_version}" "${go_k6_bin}" >&2
	GOBIN="${go_bin_dir}" go install "go.k6.io/k6@${go_k6_version}"
	printf '%s' "${go_k6_bin}"
}

ensure_downloaded_k6_binary() {
	local download_dir="${LOADTEST_K6_BIN_DIR:-${REPO_ROOT}/.cache/loadtest/bin}"
	local download_version="${LOADTEST_K6_VERSION:-v0.49.0}"
	local connect_timeout="${LOADTEST_K6_DOWNLOAD_CONNECT_TIMEOUT:-3}"
	local max_time="${LOADTEST_K6_DOWNLOAD_MAX_TIME:-15}"
	local os_name arch_name archive_name archive_url archive_path extract_root extracted_k6

	if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
		return 1
	fi

	os_name="${LOADTEST_K6_OS:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
	# Grafana k6 release 在 macOS 下使用 macos 作为资产前缀，而不是 darwin。
	if [[ "${os_name}" == "darwin" ]]; then
		os_name="macos"
	fi
	case "${LOADTEST_K6_ARCH:-$(uname -m)}" in
	x86_64 | amd64) arch_name="amd64" ;;
	arm64 | aarch64) arch_name="arm64" ;;
	*) return 1 ;;
	esac
	case "${os_name}" in
	linux | darwin) ;;
	*) return 1 ;;
	esac

	mkdir -p "${download_dir}"
	if [[ -x "${download_dir}/k6" ]]; then
		printf '%s' "${download_dir}/k6"
		return 0
	fi

	archive_name="k6-${download_version}-${os_name}-${arch_name}.tar.gz"
	# 允许后续切到内网镜像源；默认仍走官方 release，保持本地手工执行体验不变。
	archive_url="${LOADTEST_K6_DOWNLOAD_URL:-https://github.com/grafana/k6/releases/download/${download_version}/${archive_name}}"
	archive_path="${download_dir}/${archive_name}"
	extract_root="${download_dir}/extract-${download_version}-${os_name}-${arch_name}"

	# shell runner 没有 k6 / go / docker 时，先尝试拉固定版本二进制，失败再继续回退。
	printf 'download k6 binary: %s\n' "${archive_url}" >&2
	rm -rf "${extract_root}"
	if ! curl -fsSL --connect-timeout "${connect_timeout}" --max-time "${max_time}" "${archive_url}" -o "${archive_path}"; then
		rm -rf "${extract_root}" "${archive_path}"
		return 1
	fi
	mkdir -p "${extract_root}"
	if ! tar -xzf "${archive_path}" -C "${extract_root}"; then
		rm -rf "${extract_root}" "${archive_path}"
		return 1
	fi
	extracted_k6="$(find "${extract_root}" -type f -name k6 | head -n1)"
	if [[ -z "${extracted_k6}" ]]; then
		rm -rf "${extract_root}" "${archive_path}"
		return 1
	fi
	mv "${extracted_k6}" "${download_dir}/k6"
	chmod +x "${download_dir}/k6"
	rm -rf "${extract_root}" "${archive_path}"
	printf '%s' "${download_dir}/k6"
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
apply_k6_flag_overrides "${extra_args[@]}"

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
prometheus_rw_url="${LOADTEST_PROMETHEUS_RW_URL:-}"
prometheus_rw_trend_stats="${LOADTEST_PROMETHEUS_RW_TREND_STATS:-p(95),p(99),avg,max,min}"
loadtest_source="${LOADTEST_SOURCE:-manual}"
dashboard_flag="$(printf '%s' "${k6_dashboard}" | tr '[:upper:]' '[:lower:]')"
k6_run_args=(
	--tag "testid=${loadtest_run_id}"
	--tag "loadtest_scenario=${scenario}"
	--tag "loadtest_source=${loadtest_source}"
)

mkdir -p "${output_dir}"

if [[ -n "${prometheus_rw_url}" ]]; then
	# 统一给每轮压测打 testid/scenario/source 标签，方便 Grafana 只筛当前批次。
	k6_run_args=(-o experimental-prometheus-rw "${k6_run_args[@]}")
fi

cat >"${meta_path_host}" <<EOF
SCENARIO=${scenario}
BASE_URL=${base_url}
LOADTEST_RUN_ID=${loadtest_run_id}
LOADTEST_SOURCE=${loadtest_source}
LOADTEST_HOST_HEADER=${LOADTEST_HOST_HEADER:-}
LOADTEST_AUTH_MODE=${LOADTEST_AUTH_MODE:-}
LOADTEST_USERNAME=${LOADTEST_USERNAME:-}
LOADTEST_PROMETHEUS_RW_URL=${prometheus_rw_url}
LOADTEST_PROMETHEUS_RW_ENABLED=$([[ -n "${prometheus_rw_url}" ]] && printf 'true' || printf 'false')
K6_PROMETHEUS_RW_TREND_STATS=${prometheus_rw_trend_stats}
K6_WEB_DASHBOARD=${k6_dashboard}
K6_WEB_DASHBOARD_PORT=${k6_dashboard_port}
EOF

printf 'loadtest scenario=%s\n' "${scenario}"
printf 'loadtest run_id=%s\n' "${loadtest_run_id}"
printf 'loadtest output=%s\n' "${output_dir}"

local_k6_bin=""
if command -v k6 >/dev/null 2>&1; then
	# GitLab shell runner 的推荐路径是宿主机固定安装 k6，避免每轮压测都依赖外网下载。
	local_k6_bin="$(command -v k6)"
elif local_k6_bin="$(ensure_downloaded_k6_binary)"; then
	:
elif local_k6_bin="$(ensure_go_k6_binary)"; then
	:
fi

if [[ -n "${local_k6_bin}" ]]; then
	printf 'LOADTEST_ENGINE=k6\n' >>"${meta_path_host}"
	export BASE_URL="${base_url}"
	export LOADTEST_RUN_ID="${loadtest_run_id}"
	export K6_WEB_DASHBOARD="${k6_dashboard}"
	export K6_WEB_DASHBOARD_OPEN="${k6_dashboard_open}"
	export K6_WEB_DASHBOARD_PORT="${k6_dashboard_port}"
	export K6_WEB_DASHBOARD_EXPORT="${K6_WEB_DASHBOARD_EXPORT:-${dashboard_path_host}}"
	export K6_PROMETHEUS_RW_SERVER_URL="${prometheus_rw_url}"
	export K6_PROMETHEUS_RW_TREND_STATS="${prometheus_rw_trend_stats}"

	"${local_k6_bin}" run --summary-export "${summary_path_host}" "${k6_run_args[@]}" "${extra_args[@]}" "${script_path_host}"
else
	if [[ "${scenario}" == "health" || "${scenario}" == "system" ]]; then
		# shell runner 无法下载 k6 时，退化到仓库内置 curl 方案，保证一键入口仍可用。
		printf 'LOADTEST_ENGINE=curl-fallback\n' >>"${meta_path_host}"
		export BASE_URL="${base_url}"
		export LOADTEST_RUN_ID="${loadtest_run_id}"
		export LOADTEST_SUMMARY_PATH="${summary_path_host}"
		export LOADTEST_REPORT_PATH="${dashboard_path_host}"
		bash "${SCRIPT_DIR}/curl_fallback.sh" "${scenario}"
		exit 0
	fi
	if ! command -v docker >/dev/null 2>&1; then
		printf '缺少 k6 / Docker / go-install 兜底，无法运行压测\n' >&2
		exit 127
	fi
	printf 'LOADTEST_ENGINE=docker\n' >>"${meta_path_host}"
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
		-e K6_PROMETHEUS_RW_SERVER_URL="${prometheus_rw_url}" \
		-e K6_PROMETHEUS_RW_TREND_STATS="${prometheus_rw_trend_stats}" \
		"${k6_image}" \
		run --summary-export /artifacts/summary.json "${k6_run_args[@]}" "${extra_args[@]}" "${script_path_container}"
fi

printf 'summary json: %s\n' "${summary_path_host}"
printf 'dashboard html: %s\n' "${dashboard_path_host}"
