# webapp-template

## 项目简介

Web 全后端单体模板项目，提供前端管理台、Kratos 后端与本地质量门禁脚本。

## 目录结构

- `web/`：前端项目（Vite + React）
- `server/`：后端项目（Kratos + Ent + Atlas）
- `scripts/`：本地质量门禁与 Git hooks
- `docs/`：根目录文档与说明

## 快速开始

### 1) 启动前端

```bash
cd /Users/simon/projects/webapp-template/web
pnpm install
pnpm start
```

默认地址：`http://localhost:5173`

### 2) 启动后端

```bash
cd /Users/simon/projects/webapp-template/server
make init
make run
```

### 3) 数据迁移（Ent + Atlas）

```bash
cd /Users/simon/projects/webapp-template/server
make data
make migrate_apply
```

## 常用质量命令

```bash
# 环境体检（依赖/版本/hooks）
bash /Users/simon/projects/webapp-template/scripts/doctor.sh

# 开发期快速检查
bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh

# 提交前全量检查
bash /Users/simon/projects/webapp-template/scripts/qa/full.sh

# 发版前严格检查（warning 也阻断）
bash /Users/simon/projects/webapp-template/scripts/qa/strict.sh

# shell 脚本格式化
bash /Users/simon/projects/webapp-template/scripts/qa/shfmt.sh

# Go 漏洞扫描
bash /Users/simon/projects/webapp-template/scripts/qa/govulncheck.sh

# 首次启用本地 hooks
bash /Users/simon/projects/webapp-template/scripts/setup-git-hooks.sh
```

说明：当前 `web/package.json` 未定义 `test` 脚本。

## 本地质量门禁（无 CI）

- `pre-commit`：增量 `Prettier + ESLint --fix + shfmt`，并执行 `gitleaks + shellcheck + go vet + golangci-lint + yamllint`（Go/YAML 按改动触发，golangci-lint 仅拦截新增问题）
- `pre-push`：先执行 `scripts/qa/shellcheck.sh`（严格）再执行 `SECRETS_STRICT=1 scripts/qa/full.sh`
- `commit-msg`：校验提交信息（Conventional Commits）

质量脚本详细说明见：`/Users/simon/projects/webapp-template/scripts/README.md`

## 文档索引

### 根目录文档

- 协作约定：`/Users/simon/projects/webapp-template/AGENTS.md`
- 进度记录：`/Users/simon/projects/webapp-template/progress.md`

### 子目录文档

- 脚本说明：`/Users/simon/projects/webapp-template/scripts/README.md`
- 后端说明：`/Users/simon/projects/webapp-template/server/README.md`
- 前端说明：`/Users/simon/projects/webapp-template/web/README.md`
- 根级 docs 说明：`/Users/simon/projects/webapp-template/docs/README.md`

### 专题文档

- `/Users/simon/projects/webapp-template/server/docs/ent.md`
- `/Users/simon/projects/webapp-template/server/docs/k8s.md`
- `/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`

## 数据库迁移约束

`server` 使用 Ent + Atlas 工作流：

- 禁止手写 SQL
- 必须通过 `make data` 生成迁移
- 迁移文件需纳入版本管理

流程详见：`/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`
