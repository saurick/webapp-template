#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if [[ "${SKIP_PRE_PUSH:-0}" == "1" ]]; then
  echo "[pre-push] SKIP_PRE_PUSH=1，跳过检查"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[pre-push] 未找到 pnpm，请先安装 pnpm"
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  echo "[pre-push] 未找到 go，请先安装 Go"
  exit 1
fi

echo "[pre-push] 运行 web 质量检查"
(
  cd "$ROOT_DIR/web"
  pnpm lint
  pnpm css
  # 兼容模板差异：仅在存在 test 脚本时执行测试，避免无测试脚本的仓库被误拦截。
  if node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));process.exit(pkg.scripts&&pkg.scripts.test?0:1)"; then
    pnpm test
  else
    echo "[pre-push] web/package.json 未定义 test，跳过前端测试"
  fi
  pnpm build
)

echo "[pre-push] 运行 server 质量检查"
(
  cd "$ROOT_DIR/server"
  go test ./...
  make build
)

echo "[pre-push] 全部通过"
