# webapp-template

## 项目简介

Web 全后端单体模板项目，提供用户端基础页面、可选 antd admin preset、Kratos 后端与本地质量门禁脚本。

## 目录结构

| 路径 | 职责 |
| --- | --- |
| `web/` | 前端项目（Vite + React），内部目录职责见 [`web/README.md`](web/README.md) |
| `server/` | 后端项目（Kratos + Ent + Atlas），内部目录职责见 [`server/README.md`](server/README.md) |
| `scripts/` | 本地质量门禁与 Git hooks，详见 [`scripts/README.md`](scripts/README.md) |
| [`.agents/skills/`](.agents/skills/README.md) | Codex 项目专项 SOP：代码审查、文档、模板边界、页面、测试和统一 operations；通用提示词与 Git 收口使用全局 skills |
| `docs/` | 根目录文档与说明，阅读入口见 [`docs/README.md`](docs/README.md) |

若需要查看 `web/` 或 `server/` 的内部目录，不在根 README 继续展开，以各自子目录 README 为准，避免同一份结构说明在多处漂移。

## 快速开始

### 1) 启动前端

```bash
cd /Users/simon/projects/webapp-template/web
pnpm install
pnpm start
```

前端地址由仓库根 `config/dev-ports.env` 的 `DEV_WEB_PORT` 决定。可在根目录运行 `node scripts/dev-ports.mjs show` 查看完整地址组；`pnpm start` 启用 `strictPort`，端口被占用时会直接失败，不会顺延到另一个项目的地址。

### 2) 启动后端

```bash
cd /Users/simon/projects/webapp-template/server
make init
make run
```

本地后端 HTTP / gRPC 分别使用 manifest 的 `DEV_HTTP_PORT` / `DEV_GRPC_PORT`。`make run` / `make dev` 会导出同一份端口组给服务端，前端代理也从该 manifest 推导 HTTP 端口。

本地固定端口 bundle：

| 用途 | manifest 字段 |
| --- | --- |
| Vite | `DEV_WEB_PORT` |
| HTTP | `DEV_HTTP_PORT` |
| gRPC | `DEV_GRPC_PORT` |
| `style:l1` | `DEV_STYLE_PORT` |
| 临时/预览保留区间 | 从 `DEV_AUX_PORT_START` 起的完整辅助块 |

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
说明：当前仓库里 `bash scripts/qa/fast.sh` 更接近粗粒度冒烟，`bash scripts/qa/full.sh` 是仓库级全量 QA；若本轮是前端样式/布局任务，仍应额外执行 `cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test`，并做浏览器级回归。

## 新项目初始化

当你把模板复制成一个新仓库后，建议按下面顺序执行：

```bash
bash /Users/simon/projects/webapp-template/scripts/init-project.sh
bash scripts/init-project.sh --project --allocate-dev-ports --project-id <项目标识>
bash /Users/simon/projects/webapp-template/scripts/bootstrap.sh
bash /Users/simon/projects/webapp-template/scripts/doctor.sh
bash /Users/simon/projects/webapp-template/scripts/init-project.sh --project --strict
bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh
bash /Users/simon/projects/webapp-template/scripts/qa/full.sh
```

说明：

- `init-project.sh` 会扫描模板残留、默认密钥、部署主机、页面标题、模块裁剪点等初始化必改项。
- `--allocate-dev-ports` 会扫描 `/Users/simon/projects` 同级仓库的 `config/dev-ports.env`，只在项目创建时分配下一组固定端口和独占的 100 端口辅助区间，并同步直接启动使用的 dev YAML；日常主入口不会自动顺延。
- 正式文档只引用 manifest 字段或 `node scripts/dev-ports.mjs show`，不复制端口数字；初始化审计会阻断 manifest、dev YAML 与文档真源漂移。
- 初始化专项说明与“给 AI 的标准输入模板”见：`/Users/simon/projects/webapp-template/docs/project-init.md`
- 部署模板总览见：`/Users/simon/projects/webapp-template/server/deploy/README.md`
- 当前模板前台与后台入口分离：`/`、`/login`、`/register` 只承载普通用户工作台与注册登录；后台从 `/admin-login` 进入，登录后访问 `/admin-menu`、`/admin-accounts`、`/admin-rbac`。
- 当前模板后台按 admin preset 保留 antd 简约后台、账号目录、角色权限概览和 basic RBAC 服务端校验；积分 / 订阅 / 邀请码 / 层级等业务模块已从模板主干移除，具体项目若需要，应在派生仓库按需新增。
- 如果派生项目不是后台项目，可按 `/Users/simon/projects/webapp-template/docs/admin-preset.md` 的边界裁掉 admin preset。
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
- Admin preset 与 basic RBAC：`/Users/simon/projects/webapp-template/docs/admin-preset.md`

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
