# Compose 部署模板

本目录提供一套可直接复制到派生项目的 Compose 部署模板，包含：

部署目录总览见 `/Users/simon/projects/webapp-template/server/deploy/README.md`。

- `compose.yml`：PostgreSQL + Jaeger + 业务服务的最小部署骨架（默认使用本项目自己的 `postgres/jaeger` 服务名，也保留环境变量覆盖兜底）
- `.env.example`：路径、端口、镜像和数据库参数占位
- `deploy_server.sh`：远端宿主机增量发布脚本
- `publish_server.sh`：本地 build + save + rsync + 远端部署串联脚本
- `migrate_online.sh`：通过临时 Atlas 容器执行迁移

## 快速开始

```bash
cd /path/to/your-project/server/deploy/compose/prod
cp .env.example .env

# 按实际环境替换以下最关键字段：
# PROJECT_SLUG APP_IMAGE POSTGRES_PASSWORD POSTGRES_DATA_DIR

docker compose -f compose.yml up -d
```

## 发布脚本

```bash
cd /path/to/your-project/server/deploy/compose/prod

# 默认读取当前目录 app-server.tar
sh deploy_server.sh

# 或手动指定镜像包路径
sh deploy_server.sh /data/release/app-server.tar
```

脚本流程：

- `docker load -i ...` 导入镜像
- `stop + rm` 仅重建 `app-server` 服务容器
- 使用当前 compose 项目默认网络，不复用外部共享网络
- `docker compose up -d --no-deps app-server` 拉起新容器

## 本地一键发布

```bash
cd /path/to/your-project/server/deploy/compose/prod
sh publish_server.sh
```

默认执行步骤：

- 先执行远端资源预检（默认要求可用内存、磁盘与目标 PostgreSQL 健康状态达标）
- 同步当前仓库的 `migrate_online.sh` 与 migration 目录到远端，并默认检查线上是否存在 pending migration
- 在 `server` 目录执行 `make build_server`
- `docker save -o output/app-server.tar your-project-server:dev`
- `rsync -avz -e "ssh" output/app-server.tar deploy@deploy.example.com:~/deploy/your-project`
- 上传 `deploy_server.sh` 与 `compose.yml` 到远端独立目录
- 远端执行 `sh ./deploy_app_server.sh app-server.tar`
- 自动执行部署后检查（默认 `AUTO_SMOKE=auto`）

## 推荐覆盖的环境变量

```bash
# 项目标识（用于预检和 smoke 默认容器名）
export PROJECT_SLUG=webapp-template

# 本地导出的镜像名
export IMAGE_NAME=webapp-template-server:dev

# 本地镜像包路径
export IMAGE_TAR=/path/to/output/app-server.tar

# 远端主机/用户（REMOTE_HOST 必填）
export REMOTE_HOST=deploy.example.com
export REMOTE_USER=deploy

# 远端目录与文件名
export REMOTE_DIR=~/deploy/your-project
export REMOTE_SCRIPT_NAME=deploy_app_server.sh
export REMOTE_COMPOSE_FILE_NAME=compose.app-server.yml
export REMOTE_MIGRATE_SCRIPT_NAME=migrate_online.sh
export REMOTE_MIGRATE_DIR_NAME=migrate
export POSTGRES_DSN='postgres://postgres:***@postgres:5432/test_database_atlas?sslmode=disable'
export TRACE_ENDPOINT=jaeger:4318

# 线上迁移策略（默认 check）
# off: 跳过；check: status + dry-run，并在有 pending migration 时阻断发布；apply: 直接 apply 后继续发布
export DB_MIGRATION_MODE=check

# 部署后检查策略（off/basic/auto/strict）
export AUTO_SMOKE=auto
export SIM_HTTP_PORT=8200
export SIM_ADMIN_HTTP_PORT=
export HEALTH_PATH=/healthz
export READY_PATH=/readyz
export SMOKE_TIMEOUT=8
export SMOKE_CONTAINER_NAME=your-project-server
export SMOKE_CHECK_ORIGIN=remote

# 远端资源预检（默认开启）
export PRE_DEPLOY_PREFLIGHT=on
export PREFLIGHT_MIN_MEM_AVAILABLE_MB=640
export PREFLIGHT_MAX_ROOT_USAGE_PCT=90
export PREFLIGHT_FAIL_ON_POSTGRES_UNHEALTHY=1
export PREFLIGHT_POSTGRES_CONTAINER_NAME=your-project-postgres
```

## 远端资源预检

- `publish_server.sh` 默认会在构建前先 SSH 到远端检查资源。
- 当前检查项：
  - `MemAvailable` 不低于 `PREFLIGHT_MIN_MEM_AVAILABLE_MB`
  - 根分区使用率不高于 `PREFLIGHT_MAX_ROOT_USAGE_PCT`
  - `PREFLIGHT_POSTGRES_CONTAINER_NAME` 对应容器为 `healthy`（当 `PREFLIGHT_FAIL_ON_POSTGRES_UNHEALTHY=1`）
- 模板默认值按 4G 单机部署收口，派生项目如果自定义了 `PROJECT_SLUG` 或 PostgreSQL 容器名，记得同步覆盖 `PREFLIGHT_POSTGRES_CONTAINER_NAME`。

## 线上迁移联动

- `DB_MIGRATION_MODE=check`（默认）：发布前先把当前仓库的 migration 目录同步到远端，并执行 `status + dry-run`；只要发现 pending migration，就直接阻断发布。
- `DB_MIGRATION_MODE=apply`：发布前先在远端执行 `migrate_online.sh --apply`，确认 migration 已正式落库后再继续发版。
- `DB_MIGRATION_MODE=off`：跳过线上迁移检查，仅适用于你明确接受风险或正在处理首次冷启动等特殊场景。

适用原因：
- 模板层若不默认挡住 pending migration，派生项目很容易复用出“代码已发布、目标库还没 apply migration”的事故。
- 仅靠 `db-guard.sh` 只能防“忘了生成 migration 文件”，防不了“migration 文件已经提交，但线上库还没 apply”。

## 迁移脚本

```bash
cd /path/to/your-project/server/deploy/compose/prod

# 仅查看状态
sh migrate_online.sh --status-only

# 默认：状态 + dry-run
sh migrate_online.sh

# 一键执行：状态 + dry-run + apply
sh migrate_online.sh --apply
```

常用覆盖项：

```bash
export COMPOSE_FILE=/path/to/compose.yml
export MIG_DIR=/path/to/server/internal/data/model/migrate
export POSTGRES_SERVICE=postgres
export DB_URL='postgres://postgres:***@postgres:5432/test_database_atlas?sslmode=disable'
export ATLAS_IMAGE=arigaio/atlas:latest
```

## 说明

- `compose.yml` 已参数化路径、端口、镜像和容器名，优先通过 `.env` 调整，避免直接改 YAML。
- `app-server` 默认等待 `postgres` healthcheck 通过后再启动，适合模板场景下的最小就绪基线。
- 模板默认预算按 4G 单机收口：`PostgreSQL 512m + Jaeger 128m + App 192m`；如果派生项目更重，再通过 `.env` 抬高对应内存变量。
- `POSTGRES_DSN`、`TRACE_ENDPOINT` 默认应保持 `postgres:5432`、`jaeger:4318`；只有接外部中间件或迁移排障时才建议改为外部地址。
- `Jaeger` 仅作为可选模板依赖保留；若项目不需要自带 tracing 存储，可直接删掉该服务和对应端口。
- `migrate_online.sh` 通过临时 Atlas 容器执行迁移，不依赖业务容器内安装 `atlas`。
- 这套模板更偏“单项目单机 / 单台服务器”场景；如果派生项目走 K8s，请优先使用 `server/deploy/dev`、`server/deploy/prod` 下的清单模板。
