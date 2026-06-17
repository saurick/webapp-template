# Service

`service` 层负责协议适配，不负责落业务规则。

当前模板里它的职责比较薄：

- 接收 JSON-RPC 请求
- 按 JSON-RPC `url/method` 做协议分发、权限检查和结果映射
- 记录入口日志
- 调用 `biz` 层 usecase
- 把结果包装回协议层返回结构

当前 JSON-RPC 主链路：

```text
/rpc/{url}
  -> JsonrpcService
  -> jsonrpcDispatcher
  -> biz usecase
  -> data repo
```

`jsonrpcDispatcher` 是 JSON-RPC 协议入口的分发边界，只负责把 `url/method/params` 转成对应 usecase 调用，并统一处理登录态、管理员权限、权限码和 JSON-RPC 结果映射。它不直接承载业务规则，也不直接访问数据库；需要持久化数据时必须通过 `biz` usecase 进入 `data` repo。

模板层默认保持轻量：当前 `system / auth / user / rbac` 这类通用域可以继续集中在 `jsonrpc_dispatch.go`。只有出现下面任一情况时，才建议像业务 ERP 项目一样继续拆分 dispatcher 文件：

- 新增第一个真实业务 JSON-RPC 域，且不再只是模板级账号 / RBAC 骨架。
- `jsonrpc_dispatch.go` 超过约 1000 行，或单个域的 handler / mapper / helper 超过约 250-300 行。
- auth、admin/RBAC、业务域、参数解析或错误映射开始互相穿插，导致新增接口必须跨多个不相关代码块定位。
- 同类权限检查、参数解析、结果映射在多个域重复出现，已经值得收口成明确 helper 或独立职责文件。

如果派生项目后续新增 gRPC / HTTP DTO 转换逻辑，也建议继续把协议细节留在 `service` 层，不要回灌到 `biz`。

补充说明见：

- `/Users/simon/projects/webapp-template/server/docs/api.md`
- `/Users/simon/projects/webapp-template/server/docs/runtime.md`
