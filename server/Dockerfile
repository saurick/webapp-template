# server/Dockerfile

# 构建阶段使用宿主架构；运行时与 Go 目标统一跟随 docker buildx --platform。
ARG NODE_BUILDER_IMAGE=node:24.21.0
ARG GO_BUILDER_IMAGE=golang:1.26.9
ARG RUNTIME_BASE_IMAGE=alpine:3.21
ARG PNPM_VERSION=10.34.5

# ======================
# 1) 构建前端静态文件
# ======================
# 与根目录 .n-node-version 对齐，避免容器与本地 Node 小版本漂移；同时保留 build arg，便于在受限网络下切换镜像源。
FROM --platform=$BUILDPLATFORM ${NODE_BUILDER_IMAGE} AS web-builder
ARG PNPM_VERSION

WORKDIR /web

COPY web/package.json web/pnpm-lock.yaml ./
RUN npm install -g "pnpm@${PNPM_VERSION}" && \
    pnpm config set store-dir /web/.pnpm-store && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile

COPY web/src ./src
COPY web/public ./public
COPY web/index.html ./
COPY web/.env.production ./
COPY web/vite.config.mjs ./
COPY web/tailwind.config.js ./
COPY web/postcss.config.js ./
# 前端 prebuild 读取服务端错误码真源，Vite 配置读取端口 manifest。
COPY scripts /scripts
COPY config/dev-ports.env /config/dev-ports.env
COPY server/internal/errcode /server/internal/errcode
RUN pnpm run build   # 输出到 web/build

# ======================
# 2) Builder 阶段
# ======================
FROM --platform=$BUILDPLATFORM ${GO_BUILDER_IMAGE} AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

ADD server/go.mod ./go.mod
ADD server/go.sum ./go.sum

RUN go env -w GOPROXY=https://goproxy.cn,direct

RUN --mount=type=cache,id=gomod,target=/go/pkg/mod \
    --mount=type=cache,id=gobuild,target=/root/.cache/go-build \
    go mod download

COPY server/ /src

ENV CGO_ENABLED=0

ARG GIT_SHA
ARG GIT_SHA_SHORT
ARG BUILD_TIME
ARG IMAGE_TAG

ENV GIT_SHA=${GIT_SHA}
ENV GIT_SHA_SHORT=${GIT_SHA_SHORT}
ENV BUILD_TIME=${BUILD_TIME}
ENV IMAGE_TAG=${IMAGE_TAG}
ENV TZ=Asia/Shanghai

# Go 交叉编译与最终镜像共用 BuildKit 目标平台。
RUN --mount=type=cache,id=gomod,target=/go/pkg/mod \
    --mount=type=cache,id=gobuild,target=/root/.cache/go-build \
    mkdir -p bin && \
    GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
      -ldflags "-X main.Version=${GIT_SHA}" \
      -o ./bin/server ./cmd/server

# ======================
# 3) Runtime 阶段
# ======================
FROM ${RUNTIME_BASE_IMAGE}

ARG ALPINE_MIRROR
RUN if [ -n "${ALPINE_MIRROR}" ]; then \
      case "${ALPINE_MIRROR}" in \
        https://*/alpine|https://*/alpine/) ;; \
        *) echo "ALPINE_MIRROR must be a public HTTPS Alpine base URL" >&2; exit 1 ;; \
      esac; \
      case "${ALPINE_MIRROR}" in \
        *[[:space:]@?#]*) echo "ALPINE_MIRROR must not contain credentials, queries or whitespace" >&2; exit 1 ;; \
      esac; \
      version="$(cut -d. -f1,2 /etc/alpine-release)"; \
      printf '%s/v%s/main\n%s/v%s/community\n' \
        "${ALPINE_MIRROR%/}" "${version}" "${ALPINE_MIRROR%/}" "${version}" > /etc/apk/repositories; \
    fi && apk add --no-cache tzdata ca-certificates

ARG GIT_SHA
ARG GIT_SHA_SHORT
ARG BUILD_TIME
ARG IMAGE_TAG

ENV GIT_SHA=${GIT_SHA}
ENV GIT_SHA_SHORT=${GIT_SHA_SHORT}
ENV BUILD_TIME=${BUILD_TIME}
ENV IMAGE_TAG=${IMAGE_TAG}
ENV TZ=Asia/Shanghai

WORKDIR /app

COPY --from=builder /src/bin/server /app/server
COPY --from=builder /src/configs/prod/config.yaml /app/configs/config.yaml
COPY --from=web-builder /web/build /app/public

EXPOSE 8000
EXPOSE 9000

# 默认用 /app/configs （里面只有 prod/config.yaml）
CMD ["/app/server", "-conf", "/app/configs"]
