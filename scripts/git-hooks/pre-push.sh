#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if [[ "${SKIP_PRE_PUSH:-0}" == "1" ]]; then
	echo "[pre-push] SKIP_PRE_PUSH=1，跳过检查"
	exit 0
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[pre-push] 未找到 node，请先安装 Node.js"
	exit 1
fi

exec node "$ROOT_DIR/scripts/git-hooks/pre-push.mjs" "$@"
