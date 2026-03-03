#!/usr/bin/env sh
set -eu

# 设计意图：把本地构建、打包、上传、远端发布串成固定流程，降低手工执行遗漏风险。
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../../.." && pwd)
SERVER_DIR="$REPO_ROOT/server"

IMAGE_NAME="${IMAGE_NAME:-webapp-template-server:dev}"
IMAGE_TAR="${IMAGE_TAR:-$REPO_ROOT/output/template-server.tar}"
REMOTE_HOST="${REMOTE_HOST:-47.84.12.211}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-~/deploy/webapp-template}"
REMOTE_SCRIPT_NAME="${REMOTE_SCRIPT_NAME:-deploy_webapp_template_server.sh}"
REMOTE_COMPOSE_FILE_NAME="${REMOTE_COMPOSE_FILE_NAME:-compose.webapp-template.yml}"
AUTO_SMOKE="${AUTO_SMOKE:-auto}"
SIM_HTTP_PORT="${SIM_HTTP_PORT:-8200}"
SIM_ADMIN_HTTP_PORT="${SIM_ADMIN_HTTP_PORT:-}"
HEALTH_PATH="${HEALTH_PATH:-/healthz}"
READY_PATH="${READY_PATH:-/readyz}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-8}"
SMOKE_CONTAINER_NAME="${SMOKE_CONTAINER_NAME:-webapp-template-server}"
SMOKE_CHECK_ORIGIN="${SMOKE_CHECK_ORIGIN:-remote}"

usage() {
  cat <<'EOF'
用法:
  sh publish_server.sh

默认流程:
  1) (cd server && make build_server)
  2) docker save -o output/template-server.tar webapp-template-server:dev
  3) rsync -avz -e "ssh" output/template-server.tar root@47.84.12.211:~/deploy/webapp-template
  4) 上传 deploy_server.sh + compose.yml 到远端独立目录
  5) ssh 到远端执行项目专属部署脚本

可选环境变量:
  IMAGE_NAME    本地导出的镜像名（默认 webapp-template-server:dev）
  IMAGE_TAR     本地镜像包路径（默认仓库根目录 output/template-server.tar）
  REMOTE_HOST   远端主机（默认 47.84.12.211）
  REMOTE_USER   远端用户（默认 root）
  REMOTE_DIR    远端上传目录（默认 ~/deploy/webapp-template）
  REMOTE_SCRIPT_NAME 远端部署脚本文件名（默认 deploy_webapp_template_server.sh）
  REMOTE_COMPOSE_FILE_NAME 远端 compose 文件名（默认 compose.webapp-template.yml）
  AUTO_SMOKE    部署后检查策略（off/basic/auto/strict，默认 auto）
  SIM_HTTP_PORT 业务 HTTP 端口（默认 8200）
  SIM_ADMIN_HTTP_PORT 管理 HTTP 端口（默认空，空值表示跳过管理口检查）
  HEALTH_PATH   健康检查路径（默认 /healthz）
  READY_PATH    就绪检查路径（默认 /readyz）
  SMOKE_TIMEOUT HTTP 检查超时秒数（默认 8）
  SMOKE_CONTAINER_NAME 严格检查读取日志的容器名（默认 webapp-template-server）
  SMOKE_CHECK_ORIGIN smoke 检查来源（remote/local/both，默认 remote）
EOF
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
  exit 0
fi

check_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: 未找到命令: $1" >&2
    exit 1
  fi
}

check_cmd make
check_cmd docker
check_cmd rsync
check_cmd ssh
if [ "$AUTO_SMOKE" != "off" ]; then
  check_cmd curl
fi

if [ ! -f "$SERVER_DIR/Makefile" ]; then
  echo "ERROR: 未找到 server/Makefile: $SERVER_DIR/Makefile" >&2
  exit 1
fi

REMOTE_TARGET="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_IMAGE_TAR_NAME=$(basename "$IMAGE_TAR")

collect_changed_files() {
  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi

  if ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  {
    if git -C "$REPO_ROOT" rev-parse --verify HEAD >/dev/null 2>&1 &&
      git -C "$REPO_ROOT" rev-parse --verify HEAD~1 >/dev/null 2>&1; then
      git -C "$REPO_ROOT" diff --name-only HEAD~1..HEAD || true
    fi
    git -C "$REPO_ROOT" status --porcelain 2>/dev/null | sed -E 's/^.. //'
  } | awk 'NF' | sort -u
}

resolve_smoke_mode() {
  changed_files="$1"
  case "$AUTO_SMOKE" in
  off | basic | strict)
    echo "$AUTO_SMOKE"
    return
    ;;
  auto)
    ;;
  *)
    echo "ERROR: AUTO_SMOKE 仅支持 off/basic/auto/strict，当前为 $AUTO_SMOKE" >&2
    exit 1
    ;;
  esac

  # 关键服务逻辑、配置、迁移改动默认走严格检查，其他改动走基础检查。
  if printf '%s\n' "$changed_files" | grep -Eq '^(server/internal/|server/cmd/|server/configs/|server/api/|server/internal/data/model/migrate/|server/go\.mod$|server/go\.sum$|server/Dockerfile$|server/deploy/compose/prod/compose\.yml$)'; then
    echo "strict"
    return
  fi

  echo "basic"
}

run_http_check() {
  check_name="$1"
  check_url="$2"
  remote_url=$(printf '%s' "$check_url" | sed "s#^http://${REMOTE_HOST}#http://127.0.0.1#")

  case "$SMOKE_CHECK_ORIGIN" in
  remote)
    if ssh "$REMOTE_TARGET" "curl -fsS -m ${SMOKE_TIMEOUT} '${remote_url}' >/dev/null"; then
      echo "  [OK] ${check_name}: ${remote_url} (remote)"
      return 0
    fi
    ;;
  local)
    if curl -fsS -m "$SMOKE_TIMEOUT" "$check_url" >/dev/null; then
      echo "  [OK] ${check_name}: ${check_url} (local)"
      return 0
    fi
    ;;
  both)
    if ssh "$REMOTE_TARGET" "curl -fsS -m ${SMOKE_TIMEOUT} '${remote_url}' >/dev/null"; then
      echo "  [OK] ${check_name}: ${remote_url} (remote)"
      return 0
    fi
    if curl -fsS -m "$SMOKE_TIMEOUT" "$check_url" >/dev/null; then
      echo "  [OK] ${check_name}: ${check_url} (local)"
      return 0
    fi
    ;;
  *)
    echo "ERROR: SMOKE_CHECK_ORIGIN 仅支持 remote/local/both，当前为 $SMOKE_CHECK_ORIGIN" >&2
    return 1
    ;;
  esac

  echo "ERROR: 检查失败 -> ${check_name}: remote=${remote_url}, local=${check_url}" >&2
  return 1
}

run_smoke_check() {
  smoke_mode="$1"
  base_url="http://${REMOTE_HOST}"

  if [ "$smoke_mode" = "off" ]; then
    echo "==> [6/6] 跳过部署后检查（AUTO_SMOKE=off）"
    return 0
  fi

  echo "==> [6/6] 部署后检查（mode=${smoke_mode}）"
  run_http_check "业务 healthz" "${base_url}:${SIM_HTTP_PORT}${HEALTH_PATH}"
  run_http_check "业务 readyz" "${base_url}:${SIM_HTTP_PORT}${READY_PATH}"
  if [ -n "$SIM_ADMIN_HTTP_PORT" ]; then
    run_http_check "管理 healthz" "${base_url}:${SIM_ADMIN_HTTP_PORT}${HEALTH_PATH}"
    run_http_check "管理 readyz" "${base_url}:${SIM_ADMIN_HTTP_PORT}${READY_PATH}"
  fi

  echo "  [INFO] 远端容器状态:"
  ssh "$REMOTE_TARGET" "docker ps --filter name=^/${SMOKE_CONTAINER_NAME}$ --format '{{.Names}} {{.Image}} {{.Status}}'"

  if [ "$smoke_mode" != "strict" ]; then
    return 0
  fi

  run_http_check "业务首页" "${base_url}:${SIM_HTTP_PORT}/"
  if [ -n "$SIM_ADMIN_HTTP_PORT" ]; then
    run_http_check "管理首页" "${base_url}:${SIM_ADMIN_HTTP_PORT}/"
  fi

  container_started_at=$(ssh "$REMOTE_TARGET" "docker inspect -f '{{.State.StartedAt}}' ${SMOKE_CONTAINER_NAME} 2>/dev/null" || true)
  if [ -n "$container_started_at" ]; then
    # 边界兜底：仅检查本次容器启动后的日志，避免历史重启噪音误报。
    remote_logs=$(ssh "$REMOTE_TARGET" "docker logs --since '${container_started_at}' ${SMOKE_CONTAINER_NAME} 2>&1" || true)
  else
    remote_logs=$(ssh "$REMOTE_TARGET" "docker logs --tail 200 ${SMOKE_CONTAINER_NAME} 2>&1" || true)
  fi
  if printf '%s\n' "$remote_logs" | grep -Eiq 'panic|fatal'; then
    echo "ERROR: 严格检查发现日志中包含 panic/fatal，请人工确认。" >&2
    printf '%s\n' "$remote_logs" | tail -n 40 >&2
    return 1
  fi
  echo "  [OK] 严格日志检查通过（tail 200 未发现 panic/fatal）"
}

echo "==> [1/5] 构建服务镜像"
(cd "$SERVER_DIR" && make build_server)

echo "==> [2/5] 导出镜像包: $IMAGE_NAME -> $IMAGE_TAR"
# 边界兜底：自定义 IMAGE_TAR 指向新目录时，提前创建目录避免 docker save 失败。
mkdir -p "$(dirname "$IMAGE_TAR")"
docker save -o "$IMAGE_TAR" "$IMAGE_NAME"

echo "==> [3/5] 上传镜像包到远端: ${REMOTE_TARGET}:${REMOTE_DIR}"
ssh "$REMOTE_TARGET" "mkdir -p ${REMOTE_DIR}"
rsync -avz -e "ssh" "$IMAGE_TAR" "${REMOTE_TARGET}:${REMOTE_DIR}"

echo "==> [4/5] 上传远端部署脚本与 compose: ${REMOTE_TARGET}:${REMOTE_DIR}"
rsync -avz -e "ssh" "$SCRIPT_DIR/deploy_server.sh" "${REMOTE_TARGET}:${REMOTE_DIR}/${REMOTE_SCRIPT_NAME}"
rsync -avz -e "ssh" "$SCRIPT_DIR/compose.yml" "${REMOTE_TARGET}:${REMOTE_DIR}/${REMOTE_COMPOSE_FILE_NAME}"

echo "==> [5/5] 远端执行部署脚本: ${REMOTE_SCRIPT_NAME}"
ssh "$REMOTE_TARGET" "cd ${REMOTE_DIR} && COMPOSE_FILE=./${REMOTE_COMPOSE_FILE_NAME} sh ./${REMOTE_SCRIPT_NAME} ${REMOTE_IMAGE_TAR_NAME}"

CHANGED_FILES=$(collect_changed_files || true)
CHANGED_COUNT=$(printf '%s\n' "$CHANGED_FILES" | awk 'NF{n++} END{print n+0}')
SMOKE_MODE=$(resolve_smoke_mode "$CHANGED_FILES")
if [ "$AUTO_SMOKE" = "auto" ]; then
  echo "==> 自动判定部署后检查模式: ${SMOKE_MODE}（变更文件 ${CHANGED_COUNT} 个）"
  if [ "$CHANGED_COUNT" -gt 0 ]; then
    printf '%s\n' "$CHANGED_FILES" | sed -n '1,20p' | sed 's/^/  - /'
    if [ "$CHANGED_COUNT" -gt 20 ]; then
      echo "  ...（其余省略）"
    fi
  fi
else
  echo "==> 使用指定部署后检查模式: ${SMOKE_MODE}"
fi
run_smoke_check "$SMOKE_MODE"

echo "==> 全部完成"
