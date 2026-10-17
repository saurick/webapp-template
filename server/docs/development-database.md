# 开发数据库与追踪

模板默认使用显式 loopback 的数据库占位连接，OTLP endpoint 为空。实际库名、凭据与追踪入口由派生项目的忽略配置 `configs/dev/config.local.yaml` 或 `POSTGRES_DSN` 提供，默认配置不连接个人共享服务。

`make print_db_url` 只输出地址和库名。迁移入口在解析环境覆盖后核对同一目标，默认开发启动也调用 `internal/devdbguard`。模板未登记共享远端实例，非 loopback 开发连接默认拒绝，生产配置按部署合同处理。

1. 创建本项目的本地数据库，在本地覆盖配置中填写连接；先运行 `make print_db_url` 核对库名和地址。
2. 执行 `make migrate_status` 核对 Atlas 记录，按已有授权执行 `make migrate_apply`。
3. 执行 `make dev_restart`，核对 health/ready 与受影响业务链；需要追踪时再填写本项目 OTLP endpoint。

派生项目采用共享远端开发库时，须在 `internal/devdbguard` 完整登记 Host、Port、Database 与真实 PostgreSQL system identifier，并同步测试和文档。仅填写地址不足以放行；启动与迁移仍验证实际物理实例。切库前保留备份和回滚点，避免旧目标与新目标同时写入。

数据库诊断复用 `make print_db_url`、Atlas 状态与运行时 readyz；模板不再分发另带密码默认值的独立 dbcheck 工具。管理员由配置提供明文并在服务启动时进行哈希处理，不需要修改生成密码工具的源码。
