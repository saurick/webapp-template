# server/Dockerfile

# ======================
# 1) 构建前端静态文件
# ======================
FROM node:24 AS web-builder

WORKDIR /web

COPY web/package.json web/pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm config set store-dir /web/.pnpm-store && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm install --frozen-lockfile

COPY web/ .
RUN pnpm run build   # 输出到 web/build

# ======================
# 2) Builder 阶段
# ======================
FROM golang:1.24.1 AS builder

WORKDIR /src

ADD ./go.mod ./go.mod
ADD ./go.sum ./go.sum

RUN go env -w GOPROXY=https://goproxy.cn,direct

RUN --mount=type=cache,id=gomod,target=/go/pkg/mod \
    --mount=type=cache,id=gobuild,target=/root/.cache/go-build \
    go mod download && go mod tidy

COPY . /src

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

RUN --mount=type=cache,id=gomod,target=/go/pkg/mod \
    --mount=type=cache,id=gobuild,target=/root/.cache/go-build \
    mkdir -p bin && \
    go build \
      -ldflags "-X main.Version=${GIT_SHA}" \
      -o ./bin/server ./cmd/server

# ======================
# 3) Runtime 阶段
# ======================
FROM alpine:3.21

ARG GIT_SHA
ARG GIT_SHA_SHORT
ARG BUILD_TIME
ARG IMAGE_TAG

ENV GIT_SHA=${GIT_SHA}
ENV GIT_SHA_SHORT=${GIT_SHA_SHORT}
ENV BUILD_TIME=${BUILD_TIME}
ENV IMAGE_TAG=${IMAGE_TAG}
ENV TZ=Asia/Shanghai

RUN apk add --no-cache tzdata ca-certificates

WORKDIR /app

COPY --from=builder /src/bin/server /app/server
COPY --from=builder /src/configs/prod /app/configs
COPY --from=web-builder /web/build /app/public

EXPOSE 8000
EXPOSE 9000

# 默认用 /app/configs （里面只有 prod/config.yaml）
CMD ["/app/server", "-conf", "/app/configs"]