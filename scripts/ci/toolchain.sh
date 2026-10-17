#!/usr/bin/env bash
# 由 CI job source；所有下载和编译产物放入当前项目缓存。
set -euo pipefail

ci_root="$(git rev-parse --show-toplevel)"
ci_tools_root="$ci_root/.cache/ci-tools"
if ! command -v xz >/dev/null 2>&1 || ! command -v shellcheck >/dev/null 2>&1; then
	sed -i 's@http://deb.debian.org@https://deb.debian.org@g' /etc/apt/sources.list.d/debian.sources
	apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 update
	DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 install --yes --no-install-recommends xz-utils shellcheck
fi
ci_node_version="$(tr -d '[:space:]' <"$ci_root/.n-node-version")"
case "$(uname -m)" in
x86_64) ci_node_arch=x64 ;;
aarch64) ci_node_arch=arm64 ;;
*)
	echo '[ci:tools] 不支持的 Linux 架构' >&2
	return 1
	;;
esac
mkdir -p "$ci_tools_root"

if [[ ! -x "$ci_tools_root/node-$ci_node_version/bin/node" ]]; then
	(
		ci_download="$(mktemp -d "$ci_tools_root/download.XXXXXX")"
		trap 'rm -rf -- "$ci_download"' EXIT
		ci_archive="node-v$ci_node_version-linux-$ci_node_arch.tar.xz"
		# 固定下载协议以兼容代理的 HTTP/2 stream reset，完整性仍由官方 SHA-256 核对。
		curl --http1.1 -fsSL --retry 3 --retry-max-time 180 --max-time 180 "https://nodejs.org/dist/v$ci_node_version/$ci_archive" -o "$ci_download/$ci_archive"
		curl --http1.1 -fsSL --retry 3 --retry-max-time 60 --max-time 60 "https://nodejs.org/dist/v$ci_node_version/SHASUMS256.txt" -o "$ci_download/SHASUMS256.txt"
		cd "$ci_download"
		grep -F "  $ci_archive" SHASUMS256.txt | sha256sum --check --strict
		tar -xJf "$ci_archive"
		mv "node-v$ci_node_version-linux-$ci_node_arch" "$ci_tools_root/node-$ci_node_version"
	)
fi
export PATH="$ci_tools_root/node-$ci_node_version/bin:$PATH"
ci_pnpm_version="$(node -p 'require("./web/package.json").packageManager.match(/^pnpm@([0-9.]+)/)[1]')"
if [[ ! -x "$ci_tools_root/pnpm-$ci_pnpm_version/bin/pnpm" ]]; then
	npm install --global --ignore-scripts --prefix "$ci_tools_root/pnpm-$ci_pnpm_version" "pnpm@$ci_pnpm_version"
fi
export PATH="$ci_tools_root/pnpm-$ci_pnpm_version/bin:$PATH"
export GOMODCACHE="$ci_root/.cache/go-mod" GOCACHE="$ci_root/.cache/go-build"
ci_go_version="$(go env GOVERSION)"
ci_qa_bin="$ci_tools_root/qa-$ci_go_version-gitleaks8.30.1-shfmt3.12.0-vuln1.6.0/bin"
mkdir -p "$ci_qa_bin"
export PATH="$ci_qa_bin:$PATH"
if [[ ! -x "$ci_qa_bin/gitleaks" ]]; then
	GOBIN="$ci_qa_bin" go install github.com/zricethezav/gitleaks/v8@v8.30.1
fi
if [[ ! -x "$ci_qa_bin/shfmt" ]]; then
	GOBIN="$ci_qa_bin" go install mvdan.cc/sh/v3/cmd/shfmt@v3.12.0
fi
if [[ ! -x "$ci_qa_bin/govulncheck" ]]; then
	GOBIN="$ci_qa_bin" go install golang.org/x/vuln/cmd/govulncheck@v1.6.0
fi
pnpm config set store-dir "$ci_root/.cache/pnpm"
node "$ci_root/scripts/check-toolchain.mjs"
gitleaks version
shfmt --version
shellcheck --version
