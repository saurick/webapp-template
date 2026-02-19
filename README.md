# 这是一个web全后端单体项目模板

## 本地 Git Hooks（无 CI 场景）

首次启用：

```bash
cd /Users/simon/projects/webapp-template
bash scripts/setup-git-hooks.sh
```

启用后默认行为：

- `pre-commit`：仅对暂存的 `web/` 文件执行 `Prettier`，并对 `web/src/**/*.js|jsx` 执行 `ESLint --fix`
- `pre-push`：执行全量质量检查  
  `web: pnpm lint && pnpm css && (有 test 脚本则 pnpm test) && pnpm build`  
  `server: go test ./... && make build`

常用命令：

```bash
# 查看当前 hooks 路径
git config --get core.hooksPath

# 临时跳过 pre-push（紧急场景）
SKIP_PRE_PUSH=1 git push
```
