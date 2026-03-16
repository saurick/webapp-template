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
# 模板初始化扫描（新项目从模板生成后先执行）
bash /Users/simon/projects/webapp-template/scripts/init-project.sh

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

说明：模板当前已内置最小前端回归测试，可执行 `cd /Users/simon/projects/webapp-template/web && pnpm test` 验证错误码常量与登录态错误分类。

## 新项目初始化

当你把模板复制成一个新仓库后，建议按下面顺序执行：

```bash
bash /Users/simon/projects/webapp-template/scripts/init-project.sh
bash /Users/simon/projects/webapp-template/scripts/bootstrap.sh
bash /Users/simon/projects/webapp-template/scripts/doctor.sh
bash /Users/simon/projects/webapp-template/scripts/init-project.sh --project --strict
bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh
bash /Users/simon/projects/webapp-template/scripts/qa/full.sh
```

说明：

- `init-project.sh` 会扫描模板残留、默认密钥、部署主机、页面标题、模块裁剪点等初始化必改项。
- 初始化专项说明与“给 AI 的标准输入模板”见：`/Users/simon/projects/webapp-template/docs/project-init.md`
- 部署模板总览见：`/Users/simon/projects/webapp-template/server/deploy/README.md`
- 当前模板后台默认只保留账号目录和项目收口说明页；积分 / 订阅 / 邀请码 / 层级等业务模块已从模板主干移除，具体项目若需要，应在派生仓库按需新增。
- 若当前项目明确只用 `compose`，可按需移除 K8s 清单与相关文档；删除文件默认移动到系统回收站。

## 模板健康检查基线

- 模板默认保留 `/healthz`、`/readyz`、数据库启动就绪等待，以及 `compose` 中 PostgreSQL 的 `healthcheck + depends_on: service_healthy`。
- 模板层的 `/readyz` 只覆盖通用硬依赖；当前基线是 PostgreSQL，不预埋 Redis、MQ、OSS、第三方 API 等项目特有依赖。
- 模板当前已内置健康检查最小测试、`readyz` 失败结构化日志，以及 HTTP 健康检查 / 静态路由的统一观测包装。
- 模板当前已内置 HTTP `request_id` 过滤器：优先透传 `X-Request-Id`，缺失时自动生成并回写响应头。
- 业务容器自身的 `compose healthcheck`、额外依赖的就绪检查、复杂健康详情页、K8s probe 与告警策略，默认由派生项目按实际部署方式决定。

## 错误码治理

- 服务端统一错误码目录：`/Users/simon/projects/webapp-template/server/internal/errcode/catalog.go`
- 前端统一错误码常量：`/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js`
- 前端生成码表：`/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.generated.js`（由 `node /Users/simon/projects/webapp-template/scripts/gen-error-codes.mjs` 生成，禁止手改）
- 提交前可执行：`bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh` 与 `bash /Users/simon/projects/webapp-template/scripts/qa/error-code-sync.sh`，分别拦截魔法数字和前后端漏同步。

## 本地质量门禁（无 CI）

- `pre-commit`：增量 `Prettier + ESLint --fix + shfmt`，并执行 `shellcheck + error-code-sync + error-codes + gitleaks + go vet + golangci-lint + yamllint`（Go/YAML 按改动触发，golangci-lint 仅拦截新增问题）
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
- 部署模板：`/Users/simon/projects/webapp-template/server/deploy/README.md`
- 前端说明：`/Users/simon/projects/webapp-template/web/README.md`
- 根级 docs 说明：`/Users/simon/projects/webapp-template/docs/README.md`
- 新项目初始化：`/Users/simon/projects/webapp-template/docs/project-init.md`

### 专题文档

- `/Users/simon/projects/webapp-template/server/docs/README.md`
- `/Users/simon/projects/webapp-template/server/docs/ent.md`
- `/Users/simon/projects/webapp-template/server/docs/k8s.md`
- `/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`

## 数据库迁移约束

`server` 使用 Ent + Atlas 工作流：

- 禁止手写 SQL
- 必须通过 `make data` 生成迁移
- 迁移文件需纳入版本管理

流程详见：`/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`
