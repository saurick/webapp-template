#!/usr/bin/env bash
set -euo pipefail

print_help() {
	cat <<'USAGE'
用法:
  bash scripts/bootstrap.sh

作用:
  1) 核对工具版本并安装 web/server 锁定依赖
  2) 启用本地 Git hooks
  3) 执行一次 scripts/qa/fast.sh 快速自检
  4) 提示派生项目执行初始化扫描

环境变量:
  BOOTSTRAP_SKIP_INSTALL=1    跳过依赖安装
  BOOTSTRAP_SKIP_FAST_QA=1    跳过快速自检
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	print_help
	exit 0
fi

if [[ $# -gt 0 ]]; then
	echo "[bootstrap] 不支持的参数: $*"
	print_help
	exit 1
fi

export GIT_OPTIONAL_LOCKS=0
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
	echo "[bootstrap] 未找到 Node.js，请先按 .n-node-version 安装"
	exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
	echo "[bootstrap] 未找到 pnpm，请先安装 pnpm"
	exit 1
fi

if ! command -v go >/dev/null 2>&1; then
	echo "[bootstrap] 未找到 go，请先安装 Go"
	exit 1
fi

node "$ROOT_DIR/scripts/check-toolchain.mjs"

if [[ "${BOOTSTRAP_SKIP_INSTALL:-0}" != "1" ]]; then
	echo "[bootstrap] 安装 web 依赖"
	(
		cd "$ROOT_DIR/web"
		pnpm install --frozen-lockfile
	)

	echo "[bootstrap] 下载 server Go 依赖"
	(
		cd "$ROOT_DIR/server"
		go mod download
	)
else
	echo "[bootstrap] BOOTSTRAP_SKIP_INSTALL=1，跳过依赖安装"
fi

echo "[bootstrap] 启用 Git hooks"
bash "$ROOT_DIR/scripts/setup-git-hooks.sh"

if [[ "${BOOTSTRAP_SKIP_FAST_QA:-0}" != "1" ]]; then
	echo "[bootstrap] 运行快速自检"
	bash "$ROOT_DIR/scripts/qa/fast.sh"
else
	echo "[bootstrap] BOOTSTRAP_SKIP_FAST_QA=1，跳过快速自检"
fi

echo "[bootstrap] 如当前仓库是由模板初始化的新项目，建议继续执行: bash $ROOT_DIR/scripts/init-project.sh"
echo "[bootstrap] 完成"
