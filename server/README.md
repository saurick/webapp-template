# server 后端说明

## 技术栈

- Kratos
- Ent + Atlas
- PostgreSQL
- OpenTelemetry（可选）

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
make print_db_url
make migrate_status

# 测试与构建
go test ./...
make build
```

## 数据库迁移说明

- `make migrate_apply` 默认优先读取 `server/configs/dev/config.yaml`，并允许 `config.local.yaml` 覆盖私有 DSN。
- 若 shell 里残留了历史 `DB_URL`，默认不会直接生效；只有显式设置 `USE_ENV_DB_URL=1` 才会改用环境变量。
- 可先执行 `make print_db_url` 确认当前真正命中的开发库，再执行 `make migrate_status` / `make migrate_apply`。
- `server/cmd/dburl` 只是迁移辅助命令，用来统一解析当前仓库默认 DSN，不属于服务运行时入口。

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

- 文档索引：`/Users/simon/projects/webapp-template/server/docs/README.md`
- 部署模板：`/Users/simon/projects/webapp-template/server/deploy/README.md`
- 运行说明：`/Users/simon/projects/webapp-template/server/docs/runtime.md`
- 配置说明：`/Users/simon/projects/webapp-template/server/docs/config.md`
- API 说明：`/Users/simon/projects/webapp-template/server/docs/api.md`
- 可观测性：`/Users/simon/projects/webapp-template/server/docs/observability.md`
- Ent / Atlas：`/Users/simon/projects/webapp-template/server/docs/ent.md`
- K8s：`/Users/simon/projects/webapp-template/server/docs/k8s.md`
- DB 工作流：`/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`
- 业务层说明：`/Users/simon/projects/webapp-template/server/internal/biz/README.md`
- 数据层说明：`/Users/simon/projects/webapp-template/server/internal/data/README.md`
- 服务层说明：`/Users/simon/projects/webapp-template/server/internal/service/README.md`

## 部署模板

- Docker Compose 模板：`/Users/simon/projects/webapp-template/server/deploy/compose/prod`
- Kubernetes 模板：`/Users/simon/projects/webapp-template/server/deploy/dev`、`/Users/simon/projects/webapp-template/server/deploy/prod`
- 如需了解占位符替换和目录用途，优先看 `/Users/simon/projects/webapp-template/server/deploy/README.md`
