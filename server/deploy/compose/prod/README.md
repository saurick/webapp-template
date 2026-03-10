# Compose 部署模板

本目录提供一套可直接复制到派生项目的 Compose 部署模板，包含：

部署目录总览见 `/Users/simon/projects/webapp-template/server/deploy/README.md`。

- `compose.yml`：MySQL + Jaeger + 业务服务的最小部署骨架
- `.env.example`：路径、端口、镜像和数据库参数占位
- `deploy_server.sh`：远端宿主机增量发布脚本
- `publish_server.sh`：本地 build + save + rsync + 远端部署串联脚本
- `migrate_online.sh`：通过临时 Atlas 容器执行迁移

## 快速开始

```bash
cd /path/to/your-project/server/deploy/compose/prod
cp .env.example .env

# 按实际环境替换以下最关键字段：
# PROJECT_SLUG APP_IMAGE MYSQL_ROOT_PASSWORD MYSQL_PASSWORD MYSQL_DATA_DIR MYSQL_CONF_FILE

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

- 在 `server` 目录执行 `make build_server`
- `docker save -o output/app-server.tar your-project-server:dev`
- `rsync -avz -e "ssh" output/app-server.tar deploy@deploy.example.com:~/deploy/your-project`
- 上传 `deploy_server.sh` 与 `compose.yml` 到远端独立目录
- 远端执行 `sh ./deploy_app_server.sh app-server.tar`
- 自动执行部署后检查（默认 `AUTO_SMOKE=auto`）

## 推荐覆盖的环境变量

```bash
# 本地导出的镜像名
export IMAGE_NAME=your-project-server:dev

# 本地镜像包路径
export IMAGE_TAR=/path/to/output/app-server.tar

# 远端主机/用户
export REMOTE_HOST=deploy.example.com
export REMOTE_USER=deploy

# 远端目录与文件名
export REMOTE_DIR=~/deploy/your-project
export REMOTE_SCRIPT_NAME=deploy_app_server.sh
export REMOTE_COMPOSE_FILE_NAME=compose.app-server.yml

# 部署后检查策略（off/basic/auto/strict）
export AUTO_SMOKE=auto
export SIM_HTTP_PORT=8200
export SIM_ADMIN_HTTP_PORT=
export HEALTH_PATH=/healthz
export READY_PATH=/readyz
export SMOKE_TIMEOUT=8
export SMOKE_CONTAINER_NAME=your-project-server
export SMOKE_CHECK_ORIGIN=remote
```

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
export MYSQL_SERVICE=mysql
export DB_URL='mysql://root:***@mysql:3306/app?charset=utf8mb4&parseTime=true&loc=Local&interpolateParams=true'
export ATLAS_IMAGE=arigaio/atlas:latest
```

## 说明

- `compose.yml` 已参数化路径、端口、镜像和容器名，优先通过 `.env` 调整，避免直接改 YAML。
- `app-server` 默认等待 `mysql` healthcheck 通过后再启动，适合模板场景下的最小就绪基线。
- `Jaeger` 仅作为可选模板依赖保留；若项目不需要自带 tracing 存储，可直接删掉该服务和对应端口。
- `migrate_online.sh` 通过临时 Atlas 容器执行迁移，不依赖业务容器内安装 `atlas`。
- 这套模板更偏“单项目单机 / 单台服务器”场景；如果派生项目走 K8s，请优先使用 `server/deploy/dev`、`server/deploy/prod` 下的清单模板。
