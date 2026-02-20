# server 后端说明

## 技术栈

- Kratos
- Ent + Atlas
- MySQL
- Redis

## 架构分层

执行链路：`server -> service -> biz -> data`

- `server`：协议接入层（HTTP/gRPC/JSON-RPC）
- `service`：接口适配层（DTO 转换与调用编排）
- `biz`：业务规约与 UseCase
- `data`：数据库/缓存/外部依赖访问

## 快速开始

```bash
cd /Users/simon/projects/webapp-template/server
make init
make run
```

## 常用命令

```bash
# 代码生成
make api
make all

# 数据模型与迁移
make data
make migrate_apply

# 测试与构建
go test ./...
make build
```

## 目录结构（简版）

```text
server/
├── api/
├── cmd/
├── configs/
├── internal/
│   ├── biz/
│   ├── data/
│   ├── server/
│   └── service/
├── pkg/
└── Makefile
```

## 文档索引

- Ent / Atlas：`/Users/simon/projects/webapp-template/server/docs/ent.md`
- K8s：`/Users/simon/projects/webapp-template/server/docs/k8s.md`
- DB 工作流：`/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`
- 业务层说明：`/Users/simon/projects/webapp-template/server/internal/biz/README.md`
- 数据层说明：`/Users/simon/projects/webapp-template/server/internal/data/README.md`
- 服务层说明：`/Users/simon/projects/webapp-template/server/internal/service/README.md`
