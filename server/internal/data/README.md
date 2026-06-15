# Data

`data` 层负责数据库、外部依赖和持久化 repo，不承载业务决策或 JSON-RPC 协议分发。

当前模板默认保留：

- PostgreSQL 初始化与重试
- Ent ORM 访问
- 用户 / 管理员鉴权 repo
- 后台账号目录 repo
- RBAC overview repo

数据库变更前，必须先读：

- [`AI_DB_WORKFLOW.md`](./AI_DB_WORKFLOW.md)

补充说明见：

- `/Users/simon/projects/webapp-template/server/docs/ent.md`
- `/Users/simon/projects/webapp-template/server/docs/config.md`
- `/Users/simon/projects/webapp-template/server/docs/observability.md`
