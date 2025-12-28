GOHOSTOS:=$(shell go env GOHOSTOS)
GOPATH:=$(shell go env GOPATH)

# ========================
# Git 信息（兼容在子目录执行 & 没有提交的情况）
# ========================
GIT_ROOT := $(shell git rev-parse --show-toplevel 2>/dev/null)

ifeq ($(GIT_ROOT),)
  VERSION       := local
  GIT_SHA       := local
  GIT_SHA_SHORT := local
  GIT_DIRTY     :=
else
  # 工作区是否有未提交改动（包含 staged/unstaged/未跟踪）
  GIT_DIRTY     := $(shell cd "$(GIT_ROOT)" 2>/dev/null && test -n "$$(git status --porcelain)" && echo "-local" || echo "")

  VERSION       := $(shell git -C "$(GIT_ROOT)" describe --tags --always 2>/dev/null || echo local)

  # 有 commit 就取 sha；如果仓库还没 commit（或异常）就 local
  GIT_SHA       := $(shell sh -c 'cd "$(GIT_ROOT)" && git rev-parse --verify HEAD >/dev/null 2>&1 && git rev-parse HEAD || echo local')$(GIT_DIRTY)
  GIT_SHA_SHORT := $(shell sh -c 'cd "$(GIT_ROOT)" && git rev-parse --verify HEAD >/dev/null 2>&1 && git rev-parse --short=8 HEAD || echo local')$(GIT_DIRTY)
endif

BUILD_TIME ?= $(shell date +"%Y%m%dT%H%M%S")
IMAGE_TAG  := $(BUILD_TIME)-$(GIT_SHA_SHORT)
# 镜像仓库地址先留空，export DOCKER_HOST=xxx，xxx为镜像仓库地址，后再执行 make build_server 即可
DOCKER_HOST ?=
IMAGE_NAME = $(if $(DOCKER_HOST),$(DOCKER_HOST)/simulator-server,$(NULL)simulator-server)

ifeq ($(GOHOSTOS), windows)
	Git_Bash=$(subst \,/,$(subst cmd\,bin\bash.exe,$(dir $(shell where git))))
	INTERNAL_PROTO_FILES=$(shell $(Git_Bash) -c "find internal -name *.proto")
	API_PROTO_FILES=$(shell $(Git_Bash) -c "find api -name *.proto")
else
	INTERNAL_PROTO_FILES=$(shell find internal -name *.proto)
	API_PROTO_FILES=$(shell find api -name *.proto)
endif

.PHONY: init
# init env
init:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/go-kratos/kratos/cmd/kratos/v2@latest
	go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest
	go install github.com/google/gnostic/cmd/protoc-gen-openapi@latest
	go install github.com/google/wire/cmd/wire@latest

.PHONY: config
# generate internal proto
config:
	protoc --proto_path=./internal \
	       --proto_path=./third_party \
 	       --go_out=paths=source_relative:./internal \
	       $(INTERNAL_PROTO_FILES)

# 自动收集 api 目录下所有 .proto 文件
API_PROTO_FILES := $(shell find api -name '*.proto')

# api：使用 protoc 一次性生成
#   - Go 结构体 (*.pb.go)
#   - gRPC 接口代码 (*_grpc.pb.go)
#   - gRPC-Gateway 反向代理 (*_gw.go)，rest -> grpc
#   - Kratos HTTP Handler (*_http.pb.go)
#   - OpenAPI / Swagger 文档 (swagger.json)
.PHONY: api
api:
	@echo ">>> Generating proto files..."
	protoc --proto_path=. \
	       --proto_path=./third_party \
	       --go_out=paths=source_relative:. \
	       --go-grpc_out=paths=source_relative:. \
	       --grpc-gateway_out=paths=source_relative:. \
	       --go-http_out=paths=source_relative:. \
	       --openapiv2_out . \
	       $(API_PROTO_FILES)

.PHONY: build
# build
build:
	mkdir -p bin/ && go build -ldflags "-X main.Version=$(VERSION)" -o ./bin/ ./...

.PHONY: build_linux
build_linux:
	mkdir -p bin/ && GOOS=linux GOARCH=amd64 go build -ldflags "-X main.Version=$(VERSION)" -o ./bin/ ./...

.PHONY: generate
# generate
generate:
	go mod tidy
	go get github.com/google/wire/cmd/wire@latest
	go generate ./...

.PHONY: validate
# generate validate proto
validate:
	protoc --proto_path=. \
           --proto_path=./third_party \
           --go_out=paths=source_relative:. \
           --validate_out=paths=source_relative,lang=go:. \
           $(API_PROTO_FILES)

.PHONY: all
# generate all
all:
	make api;
	make config;
	make generate;

.PHONY: ent_migrate
# 生成 migration（仅生成，不执行）
ent_migrate:
	@if ! command -v atlas >/dev/null 2>&1; then \
		echo "Installing Atlas..."; \
		curl -sSf https://atlasgo.sh | sh; \
	fi
	atlas migrate diff migrate \
		--dir "file://internal/data/model/migrate" \
		--to "ent://internal/data/model/schema" \
		--dev-url "docker://mysql/8/ent"

# 重新计算迁移目录校验，如果改了 migration 的 sql 文件，必须重新计算校验，否则migrate_apply会报错，提示Error: checksum mismatch
.PHONY: migrate_hash
migrate_hash:
	atlas migrate hash --dir "file://internal/data/model/migrate"

ENV_FILE := .env

ifneq ("$(wildcard $(ENV_FILE))","")
  include $(ENV_FILE)
  export
endif	

.PHONY: migrate_apply
# 将 migration 执行到数据库（需要你确认）
migrate_apply:
	@if [ -z "$$DB_URL" ]; then \
		echo "ERROR: DB_URL is not set. Use: export DB_URL=..."; \
		exit 1; \
	fi
	atlas migrate apply \
		--dir "file://internal/data/model/migrate" \
		--url "$$DB_URL"

.PHONY: ent_generate
# 用 ent generate 生成 ent 代码
ent_generate:
	cd internal/data/model && go generate && go mod tidy

.PHONY: data
# 最推荐流程：只生成 diff，不自动 apply
data: ent_migrate ent_generate

.PHONY: db_create
db_create:
	@if [ -z "$$DB_URL" ]; then \
		echo "ERROR: DB_URL is not set"; exit 1; \
	fi
	@# 从 DB_URL 里粗暴解析出 dbname（简单够用：取最后一个 / 后到 ? 前）
	@DBNAME=$$(echo "$$DB_URL" | sed -E 's|.*/([^/?]+).*|\1|'); \
	echo "Creating database $$DBNAME ..."; \
	mysql -h 192.168.0.106 -P 3306 -uroot -p \
	  -e "CREATE DATABASE IF NOT EXISTS \`$$DBNAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;"

# show help
help:
	@echo ''
	@echo 'Usage:'
	@echo ' make [target]'
	@echo ''
	@echo 'Targets:'
	@awk '/^[a-zA-Z\-\_0-9]+:/ { \
	helpMessage = match(lastLine, /^# (.*)/); \
		if (helpMessage) { \
			helpCommand = substr($$1, 0, index($$1, ":")); \
			helpMessage = substr(lastLine, RSTART + 2, RLENGTH); \
			printf "\033[36m%-22s\033[0m %s\n", helpCommand,helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

# 清理 dangling / builder 缓存
.PHONY: docker_prune
docker_prune:
	@echo ">>> Pruning build cache and dangling images..."
	@docker builder prune -f
	@docker image prune -f

# ========================
# Docker 构建 / 推送
# ========================

# 保留本地最新 N 个镜像（同一个 repo:tag 列表里按创建时间）
KEEP_IMAGES ?= 4

.PHONY: image_gc
image_gc:
	@echo ">>> Keeping latest $(KEEP_IMAGES) images for $(IMAGE_NAME), removing older ones..."
	@docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' '$(IMAGE_NAME)' \
		| sort -rk2 \
		| awk 'NR>$(KEEP_IMAGES){print $$1}' \
		| xargs -r docker rmi -f || true

.PHONY: build_server push_server

# 本地/开发环境额外打一个固定tag，可以是dev或者latest
# 部署时就可以一直写 simulator-server:dev（或 :latest）
FIXED_TAG ?= dev

# 构建服务器镜像（在 server/ 目录执行）
build_server:
	docker build \
		--build-arg GIT_SHA="$(GIT_SHA)" \
		--build-arg GIT_SHA_SHORT="$(GIT_SHA_SHORT)" \
		--build-arg BUILD_TIME="$(BUILD_TIME)" \
		--build-arg IMAGE_TAG="$(IMAGE_TAG)" \
		-f Dockerfile \
		-t $(IMAGE_NAME):$(IMAGE_TAG) \
		-t $(IMAGE_NAME):$(FIXED_TAG) ..
	@$(MAKE) image_gc

# 推送服务器镜像
push_server:
	@if [ -z "$(DOCKER_HOST)" ]; then echo "ERROR: DOCKER_HOST is empty"; exit 1; fi
	docker push $(IMAGE_NAME):$(IMAGE_TAG)
	docker push $(IMAGE_NAME):$(FIXED_TAG)
