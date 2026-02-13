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
- `docker compose up -d template-server` 拉起新容器

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
export DB_URL='mysql://root:***@192.168.0.106:3306/test_database_atlas?charset=utf8mb4&parseTime=true&loc=Local&interpolateParams=true'

# 指定 atlas 镜像（默认 arigaio/atlas:latest）
export ATLAS_IMAGE=arigaio/atlas:latest
```

## 说明

- 脚本通过临时 Atlas 容器执行迁移，不依赖业务容器内安装 `atlas`。
- 连接串中的密码会自动做 URL 编码兜底，避免 `%` 等字符导致解析失败。
- 优先按 compose 服务名查找 MySQL 容器，查不到时会回退匹配 `mysql8` 或 `mysql:8`。
