# Compose 线上迁移脚本

本目录提供 `migrate_online.sh`，用于在 `docker compose` 部署环境执行 Atlas 迁移。

## 服务发布脚本

本目录新增 `deploy_server.sh`，用于在宿主机一键执行服务镜像更新。

```bash
cd /path/to/webapp-template/server/deploy/compose/prod

# 默认读取当前目录 template-server.tar
sh deploy_server.sh

# 或手动指定镜像包路径
sh deploy_server.sh /data/release/template-server.tar
```

脚本流程：
- `docker load -i ...` 导入镜像
- `stop + rm` 仅重建 `template-server` 服务容器
- 使用当前 compose 项目默认网络，不复用外部共享网络
- `docker compose up -d --no-deps template-server` 拉起新容器

## 本地一键发布（build + save + rsync + deploy）

当你在本地频繁执行构建与发布，可直接使用 `publish_server.sh`：

```bash
cd /path/to/webapp-template/server/deploy/compose/prod
sh publish_server.sh
```

默认执行步骤：
- 在 `server` 目录执行 `make build_server`
- `docker save -o output/template-server.tar webapp-template-server:dev`
- `rsync -avz -e "ssh" output/template-server.tar root@47.84.12.211:~/deploy/webapp-template`
- 上传 `deploy_server.sh` 与 `compose.yml` 到远端独立目录
- 远端执行 `sh ./deploy_webapp_template_server.sh template-server.tar`
- 自动执行部署后检查（默认 `AUTO_SMOKE=auto`）

可选环境变量：

```bash
# 本地导出的镜像名（默认 webapp-template-server:dev）
export IMAGE_NAME=webapp-template-server:dev

# 本地镜像包路径（默认仓库根目录 output/template-server.tar）
export IMAGE_TAR=/path/to/output/template-server.tar

# 远端主机/用户（默认 root@47.84.12.211）
export REMOTE_HOST=47.84.12.211
export REMOTE_USER=root

# 远端上传目录与部署脚本（默认 ~/deploy/webapp-template）
export REMOTE_DIR=~/deploy/webapp-template
export REMOTE_SCRIPT_NAME=deploy_webapp_template_server.sh
export REMOTE_COMPOSE_FILE_NAME=compose.webapp-template.yml

# 部署后检查策略（默认 auto）
# off: 跳过；basic: healthz/readyz + 容器状态；strict: basic + 首页访问 + 日志 panic/fatal 扫描
export AUTO_SMOKE=auto

# 检查端口与路径（按需覆盖）
export SIM_HTTP_PORT=8200
export SIM_ADMIN_HTTP_PORT=
export HEALTH_PATH=/healthz
export READY_PATH=/readyz
export SMOKE_TIMEOUT=8
export SMOKE_CONTAINER_NAME=webapp-template-server
# smoke 检查来源：remote(默认，走远端 127.0.0.1)、local(走本机直连)、both(先远端后本机)
export SMOKE_CHECK_ORIGIN=remote
```

### 部署后自动检查策略（publish_server.sh）

- `AUTO_SMOKE=auto`（默认）：根据最近代码变更自动选择检查强度
  - 命中后端关键路径（如 `server/internal`、`server/cmd`、`server/configs`、迁移目录等）时走 `strict`
  - 其他改动走 `basic`
- `AUTO_SMOKE=basic`：固定执行基础检查
- `AUTO_SMOKE=strict`：固定执行严格检查
- `AUTO_SMOKE=off`：跳过部署后检查

说明：
- `basic`：检查业务口 `healthz` 与 `readyz`，并回显远端 `webapp-template-server` 容器状态。
- `strict`：在 `basic` 基础上再检查业务首页可访问，并扫描最近 `200` 行容器日志中是否含 `panic/fatal`。

## 运行配置约定

- 当前采用镜像部署：服务读取镜像内 `/app/configs/config.yaml`。
- 该文件在构建阶段由 `server/configs/prod/config.yaml` 复制进入镜像。
- 网络与容器隔离：本项目使用独立 compose 默认网络，`mysql/jaeger` 容器名均为项目前缀，不依赖其他项目资源。
- 首次从历史共享拓扑切换时，请先执行一次 `docker compose -f compose.yml up -d` 全量拉起依赖，再使用 `deploy_server.sh` 做增量发布。
- 线上 compose 场景请使用容器服务名互联（如 `mysql:3306`、`jaeger:4318`），避免依赖宿主机私网 IP 漂移导致重启后不可用。
- 如需修改配置，请先改 `server/configs/prod/config.yaml`，再重建并发布镜像。
- 启动就绪策略：`template-server` 会等待 `mysql` healthcheck 通过后再启动，降低宿主机重启后因数据库未就绪导致的冷启动失败。
- 迁移建议：将 `.env.example` 复制为 `.env` 后再启动，路径、端口、镜像、Prometheus 地址都通过变量管理，避免改动 `compose.yml`。

## 迁移到新服务器（最小步骤）

```bash
cd /path/to/webapp-template/server/deploy/compose/prod

# 1) 准备环境变量
cp .env.example .env

# 2) 按新机器实际情况调整 .env（至少检查数据目录和端口）
#    MYSQL_DATA_DIR, MYSQL_CONF_FILE, TEMPLATE_SERVER_IMAGE, PROMETHEUS_SERVER_URL

# 3) 启动
docker compose -f compose.yml up -d
```

可选环境变量：

```bash
# compose 文件路径（默认当前目录 compose.yml）
export COMPOSE_FILE=/path/to/compose.yml

# 需要更新的服务名（默认 template-server）
export SERVICE_NAME=template-server
```

## 前提

- 已在宿主机启动 compose：`docker compose -f compose.yml up -d`
- 可访问迁移目录：`server/internal/data/model/migrate`
- 不手写 SQL，迁移文件由 `make data` 生成

## 用法

```bash
cd /path/to/webapp-template/server/deploy/compose/prod

# 仅查看状态
sh migrate_online.sh --status-only

# 默认：状态 + dry-run
sh migrate_online.sh

# 一键执行：状态 + dry-run + apply
sh migrate_online.sh --apply
```

## 可选环境变量

```bash
# compose 文件路径（默认当前目录 compose.yml）
export COMPOSE_FILE=/path/to/compose.yml

# 迁移目录（默认自动定位到 server/internal/data/model/migrate）
export MIG_DIR=/path/to/server/internal/data/model/migrate

# compose 中 mysql 服务名（默认 mysql）
export MYSQL_SERVICE=mysql

# 手动指定 DB_URL（未设置时脚本自动从 mysql 容器推导）
export DB_URL='mysql://root:***@mysql:3306/test_database_atlas?charset=utf8mb4&parseTime=true&loc=Local&interpolateParams=true'

# 指定 atlas 镜像（默认 arigaio/atlas:latest）
export ATLAS_IMAGE=arigaio/atlas:latest
```

## 说明

- `compose.yml` 已参数化路径/端口/镜像，优先通过 `.env` 调整，避免机器迁移时改 YAML。
- 脚本通过临时 Atlas 容器执行迁移，不依赖业务容器内安装 `atlas`。
- 连接串中的密码会自动做 URL 编码兜底，避免 `%` 等字符导致解析失败。
- 仅按当前 compose 服务名查找 MySQL 容器，不跨项目兜底匹配。
