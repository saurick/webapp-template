#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[pre-commit] 未找到 pnpm，请先安装 pnpm"
  exit 1
fi

if [ ! -d "$ROOT_DIR/web" ]; then
  echo "[pre-commit] 未找到 web 目录，跳过"
  exit 0
fi

staged_files=()
while IFS= read -r -d '' file; do
  staged_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR -z)

if [ "${#staged_files[@]}" -eq 0 ]; then
  exit 0
fi

prettier_targets_web=()
prettier_targets_root=()
eslint_targets_web=()
eslint_targets_root=()

for file in "${staged_files[@]}"; do
  # 仅处理 web 暂存文件，避免提交时全仓库扫描导致过慢或误改。
  if [[ ! "$file" =~ ^web/ ]]; then
    continue
  fi

  case "$file" in
    web/node_modules/*|web/build/*)
      continue
      ;;
  esac

  case "$file" in
    *.js|*.jsx|*.ts|*.tsx|*.cjs|*.mjs|*.css|*.scss|*.sass|*.json|*.md|*.html|*.yml|*.yaml)
      prettier_targets_web+=("${file#web/}")
      prettier_targets_root+=("$file")
      ;;
  esac

  if [[ "$file" =~ ^web/src/.*\.(js|jsx)$ ]]; then
    eslint_targets_web+=("${file#web/}")
    eslint_targets_root+=("$file")
  fi
done

if [ "${#prettier_targets_web[@]}" -gt 0 ]; then
  echo "[pre-commit] 运行 Prettier（仅暂存文件）"
  (
    cd "$ROOT_DIR/web"
    pnpm exec prettier --write "${prettier_targets_web[@]}"
  )
  git add -- "${prettier_targets_root[@]}"
fi

if [ "${#eslint_targets_web[@]}" -gt 0 ]; then
  echo "[pre-commit] 运行 ESLint --fix（仅暂存文件）"
  (
    cd "$ROOT_DIR/web"
    pnpm exec eslint --fix --ext .js --ext .jsx "${eslint_targets_web[@]}"
  )
  git add -- "${eslint_targets_root[@]}"
fi

echo "[pre-commit] 完成"
