# Kratos Project Template

## 🚀 框架依赖

- **服务框架**：Kratos  
- **服务发现**：Etcd（Kratos 内置支持）  
- **链路追踪**：Jaeger  
- **ORM**：Ent  
- **缓存**：Redis  
- **业务数据库**：MySQL  
- **配置中心**：Etcd（支持动态配置热更新）

---

# 🧩 代码层级结构（Clean Architecture）

执行链路：
server → service → biz → data

### 1. server — 流量入口层
- 接入 HTTP / gRPC / JSON-RPC / 自定义协议  
- 实现 `transport.Server`（Start / Stop）即可扩展任意协议  
- 不包含业务逻辑，不做参数转换  

**职责：接入流量 → 转发到 service 层**

---

### 2. service — 接口适配层
- 接收协议层参数（protobuf / JSON-RPC / HTTP）  
- 做 DTO ⇄ 业务对象 的转换  
- 调用 biz 层的 UseCase  
- 作为 Controller，保持轻量  

**职责：协议参数 ⇄ 业务参数 的适配**

---

### 3. biz — 业务领域层（UseCase 层）
- 核心业务逻辑所在层  
- 不依赖 protobuf / HTTP / JSON-RPC  
- 不直接访问数据库和缓存  
- 依赖 Repository 抽象接口  
- 用例（UseCase）粒度为单个业务流程  

**职责：业务规约与业务流程实现**

---

### 4. data — 数据访问层
- 实现 biz 定义的 Repository 接口  
- 操作 MySQL / PostgreSQL / Redis / 外部 API 等  
- 包含数据源初始化、事务管理、缓存策略等  

**职责：数据库 / 缓存 / 外部服务的具体访问**

---

# 📁 开发目录规范

参考官方推荐的 Go 项目结构：  
https://go-kratos.dev/blog/go-project-layout

---

# 🛠 安装 Kratos

```bash
go install github.com/go-kratos/kratos/cmd/kratos/v2@latest


🏗 创建服务
# 创建模板工程
kratos new server

cd server

# 添加 proto 模板
kratos proto add api/server/server.proto

# 生成 proto 客户端
kratos proto client api/server/server.proto

# 根据 proto 生成 service 代码
kratos proto server api/server/server.proto -t internal/service

# 生成所有代码
go generate ./...

# 构建
go build -o ./bin/ ./...

# 启动
./bin/server -conf ./configs


🔧 使用 Makefile 批量生成代码
# 下载依赖
make init

# 生成 API 文件 (pb.go / http / grpc / validate / swagger)
make api

# 生成所有文件（wire + proto + ent 代码）
make all


⚙ 自动依赖注入（Wire）
# 安装 wire
go get github.com/google/wire/cmd/wire

# 生成 wire 注入代码
cd cmd/server
wire


🐳 Docker 构建与运行
# 构建镜像
docker build -t <your-docker-image-name> .

# 运行镜像
docker run --rm \
  -p 8000:8000 -p 9000:9000 \
  -v </path/to/your/configs>:/data/conf \
  <your-docker-image-name>


📁 项目目录大致结构
.
├── api/                    # protobuf / api 定义
│   └── server/             # 示例：server.proto 等
│
├── cmd/
│   └── server/
│       ├── main.go         # 程序入口
│       └── wire.go         # wire.Build 入口（依赖注入）
│
├── configs/                # 配置文件（本地开发用）
│   └── config.yaml
│
├── internal/
│   ├── conf/               # Kratos 配置结构体（由 proto 生成）
│   │   └── conf.pb.go
│   │
│   ├── server/             # server 层（http / grpc / jsonrpc）
│   │   ├── server.go
│   │   └── provider.go     # server.ProviderSet
│   │
│   ├── service/            # service 层（协议适配）
│   │   ├── user.go
│   │   └── provider.go     # service.ProviderSet
│   │
│   ├── biz/                # biz 层（UseCase）
│   │   ├── user.go
│   │   └── provider.go     # biz.ProviderSet
│   │
│   ├── data/               # data 层（Repository 实现）
│   │   ├── data.go
│   │   ├── user_repo.go
│   │   └── provider.go     # data.ProviderSet
│   │
│   └── pkg/                # 可选：公共工具库、封装
│       └── ...
│
├── third_party/            # 第三方 proto
├── Makefile
└── go.mod