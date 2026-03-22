#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'EOF'
用法:
  bash server/deploy/lab-ha/scripts/install-runner-k6.sh

可选环境变量:
  RUNNER_HOST=root@192.168.0.108
  RUNNER_USER=gitlab-runner
  K6_VERSION=v0.49.0
  K6_DOWNLOAD_URL=<override-url>
  K6_CACHE_DIR=<local-cache-dir>
  K6_REMOTE_ROOT=/opt/lab-tools
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	usage
	exit 0
fi

require_tool() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'missing required tool: %s\n' "$1" >&2
		exit 1
	}
}

require_tool curl
require_tool tar
require_tool ssh
require_tool scp

runner_host="${RUNNER_HOST:-root@192.168.0.108}"
runner_user="${RUNNER_USER:-gitlab-runner}"
k6_version="${K6_VERSION:-v0.49.0}"
k6_cache_dir="${K6_CACHE_DIR:-${HOME}/.cache/webapp-template/loadtest/k6-installer}"
k6_remote_root="${K6_REMOTE_ROOT:-/opt/lab-tools}"
archive_name="k6-${k6_version}-linux-amd64.tar.gz"
k6_download_url="${K6_DOWNLOAD_URL:-https://github.com/grafana/k6/releases/download/${k6_version}/${archive_name}}"
archive_cache_path="${k6_cache_dir}/${archive_name}"

mkdir -p "${k6_cache_dir}"
workdir="$(mktemp -d "${k6_cache_dir}/install-XXXXXX")"
remote_tmp_dir="/tmp/k6-install-${k6_version}-$$"
archive_path="${workdir}/${archive_name}"
extract_dir="${workdir}/extract"
binary_path=""

cleanup() {
	rm -rf "${workdir}"
}
trap cleanup EXIT

if [[ -f "${archive_cache_path}" ]]; then
	printf '==> reuse cached k6 archive: %s\n' "${archive_cache_path}"
	cp "${archive_cache_path}" "${archive_path}"
else
	printf '==> download k6: %s\n' "${k6_download_url}"
	if curl -fsSL --connect-timeout 5 --max-time 60 "${k6_download_url}" -o "${archive_cache_path}"; then
		cp "${archive_cache_path}" "${archive_path}"
	else
		rm -f "${archive_cache_path}"
	fi
fi

if [[ -f "${archive_path}" ]]; then
	mkdir -p "${extract_dir}"
	tar -xzf "${archive_path}" -C "${extract_dir}"
	binary_path="$(find "${extract_dir}" -type f -name k6 | head -n1)"
fi

if [[ -z "${binary_path}" || ! -f "${binary_path}" ]]; then
	require_tool go
	printf '==> fallback to local go build: %s\n' "${k6_version}"
	local_go_bin_dir="${workdir}/bin"
	mkdir -p "${local_go_bin_dir}"
	# 本机构建 linux/amd64 产物后再分发到 runner，避免 runner 继续依赖外网 release 资产源。
	GOBIN="${local_go_bin_dir}" GOOS=linux GOARCH=amd64 go install "go.k6.io/k6@${k6_version}"
	binary_path="${local_go_bin_dir}/k6"
fi

printf '==> upload k6 to %s\n' "${runner_host}"
ssh -o StrictHostKeyChecking=no "${runner_host}" "mkdir -p '${remote_tmp_dir}'"
scp -o StrictHostKeyChecking=no "${binary_path}" "${runner_host}:${remote_tmp_dir}/k6"

printf '==> install k6 on runner host\n'
ssh -o StrictHostKeyChecking=no "${runner_host}" \
	"RUNNER_USER=$(printf '%q' "${runner_user}") K6_REMOTE_ROOT=$(printf '%q' "${k6_remote_root}") K6_VERSION=$(printf '%q' "${k6_version}") REMOTE_TMP_DIR=$(printf '%q' "${remote_tmp_dir}") bash -s" <<'EOF'
set -euo pipefail

install -d "${K6_REMOTE_ROOT}/k6/${K6_VERSION}"
# 版本目录保留历史二进制，/usr/local/bin/k6 只做稳定入口，后续升级或回滚都更清晰。
install -m 0755 "${REMOTE_TMP_DIR}/k6" "${K6_REMOTE_ROOT}/k6/${K6_VERSION}/k6"
ln -sfn "${K6_REMOTE_ROOT}/k6/${K6_VERSION}/k6" /usr/local/bin/k6
rm -rf "${REMOTE_TMP_DIR}"

/usr/local/bin/k6 version
runuser -u "${RUNNER_USER}" -- /usr/local/bin/k6 version
EOF

printf '==> done: %s now has /usr/local/bin/k6 -> %s/k6/%s/k6\n' "${runner_host}" "${k6_remote_root}" "${k6_version}"
