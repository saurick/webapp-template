#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if [[ "${SKIP_PRE_PUSH:-0}" == "1" ]]; then
  echo "[pre-push] SKIP_PRE_PUSH=1，跳过检查"
  exit 0
fi

if [ ! -x "$ROOT_DIR/scripts/qa/full.sh" ]; then
  echo "[pre-push] 缺少 scripts/qa/full.sh，请先执行 bootstrap/setup"
  exit 1
fi

bash "$ROOT_DIR/scripts/qa/full.sh"
