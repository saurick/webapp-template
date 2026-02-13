#!/usr/bin/env sh
set -eu

# 设计意图：只更新目标服务容器，避免误停 mysql/jaeger 等依赖服务。
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/compose.yml}"
SERVICE_NAME="${SERVICE_NAME:-template-server}"
IMAGE_TAR="${1:-template-server.tar}"

usage() {
  cat <<'EOF'
用法:
  sh deploy_server.sh [image_tar_path]

示例:
  sh deploy_server.sh
  sh deploy_server.sh /data/release/template-server.tar

可选环境变量:
  COMPOSE_FILE   compose 文件路径（默认同目录 compose.yml）
  SERVICE_NAME   需要更新的服务名（默认 template-server）
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: compose 文件不存在: $COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f "$IMAGE_TAR" ]; then
  echo "ERROR: 镜像包不存在: $IMAGE_TAR" >&2
  exit 1
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$COMPOSE_FILE" "$@"
    return
  fi

  echo "ERROR: 未找到 docker compose / docker-compose" >&2
  exit 1
}

echo "==> [1/3] 导入镜像: $IMAGE_TAR"
docker load -i "$IMAGE_TAR"

echo "==> [2/3] 停止并移除旧容器: $SERVICE_NAME"
# 兼容性兜底：首次部署或容器不存在时不应中断流程。
compose stop "$SERVICE_NAME" >/dev/null 2>&1 || true
compose rm -f "$SERVICE_NAME" >/dev/null 2>&1 || true

echo "==> [3/3] 启动新容器: $SERVICE_NAME"
compose up -d "$SERVICE_NAME"

echo "==> 部署完成，当前状态:"
compose ps "$SERVICE_NAME"
