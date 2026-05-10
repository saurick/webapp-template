# JSON-RPC API 说明

当前模板默认只保留一套最小的 JSON-RPC 入口，用于承载通用鉴权、后台账号管理和 basic RBAC 基线能力。

## 统一入口

协议定义见：

- `/Users/simon/projects/webapp-template/server/api/jsonrpc/v1/jsonrpc.proto`

HTTP 路由：

- `GET /rpc/{url}`
- `POST /rpc/{url}`

其中：

- `{url}` 表示业务域，例如 `system`、`auth`、`user`、`rbac`
- `method` 表示具体动作，例如 `login`、`me`、`list`

## 当前默认保留的业务域

### `system`

- `ping`
- `version`

用途：无鉴权的基础联通性检查。

### `auth`

- `login`
- `admin_login`
- `register`
- `logout`
- `me`

用途：用户登录、管理员登录、注册、退出和当前登录态查询。

### `user`

- `list`
- `set_disabled`

用途：管理员查看账号目录，以及启用/禁用用户。

### `rbac`

- `overview`

用途：管理员查看模板内置角色、权限码和 basic RBAC 默认绑定。

## 鉴权规则

- `system.*` 默认是公开方法
- 其他业务域默认要求已登录
- `user.list` 要求 `admin.user.read`
- `user.set_disabled` 要求 `admin.user.write`
- `rbac.overview` 要求 `admin.rbac.read`

说明：管理员身份依赖 token 里的角色信息；具体后台操作权限以服务端 RBAC 权限码校验为准，前端页面路径和菜单隐藏不作为授权边界。

## 默认返回结构

所有 JSON-RPC 响应统一返回：

- `jsonrpc`
- `id`
- `result.code`
- `result.message`
- `result.data`
- `error`

其中：

- `result.code=0` 表示成功
- 其他错误码统一来源于 `/Users/simon/projects/webapp-template/server/internal/errcode/catalog.go`

## 模板默认保留的数据字段

### `auth.login` / `auth.admin_login` / `auth.register`

返回最小登录态信息：

- `user_id`
- `username`
- `access_token`
- `expires_at`
- `token_type`
- `issued_at`
- 管理员登录额外返回 `roles` 与 `permissions`

### `auth.me`

返回当前用户或当前管理员的最小信息，用于前端恢复登录态。

管理员返回会包含：

- `roles`
- `permissions`

### `user.list`

返回后台账号目录所需的最小字段：

- `id`
- `username`
- `disabled`
- `created_at`
- `last_login_at`

### `rbac.overview`

返回：

- `roles`
- `permissions`

## 不再属于模板主干的业务能力

以下能力已经从模板默认主干移除，不应再假定存在：

- 积分
- 订阅
- 邀请码
- 管理员层级
- 任何行业特定业务域

如果派生项目需要这些能力，应按真实需求重新定义 schema、错误码、接口和前端消费层，而不是把旧模板逻辑直接加回主干。
