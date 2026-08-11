# 前端运行时配置与可选 Preset

本文档定义模板前端的通用交互基线、运行时展示配置和可选 preset。代码决定实际行为；本文负责说明派生项目应保留、替换或接入什么，避免把开发 mock、页面开关或其他 ERP 的业务流程当成当前项目真源。

## 当前基线

| 能力                   | 默认状态         | 当前边界                                                                       |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------ |
| 路由加载与恢复         | 保留             | 懒加载失败先重试一次，仍失败时展示中文恢复页；未知地址进入 404                 |
| 异步数据状态           | 保留             | 区分首次加载、保留旧数据刷新、空数据、失败重试，不用空白页代替状态             |
| 主题                   | 保留             | 支持跟随系统、浅色、深色，并在本机持久化；前后台消费同一套语义色               |
| Admin preset           | 默认保留、可裁剪 | 独立管理员登录、响应式导航、账号目录、角色权限和使用说明                       |
| 移动工作队列           | 默认关闭         | 提供列表 → 详情 → 动作确认 → 回执 UI；业务数据和动作规则必须由派生项目接口提供 |
| 审计、附件、打印、历史 | 默认关闭         | 只定义扩展责任，不提供虚构 schema、记录或业务页面                              |

首页不会生成“最近活动”、业务统计或单据示例。派生项目没有接入正式用户端模块时，页面明确展示尚未配置，而不是用静态数据制造完成假象。

## 运行时展示配置

入口是 `/Users/simon/projects/webapp-template/web/public/app-config.js`。构建产物会在 React 启动前读取它，因此部署时可以替换品牌与已接好接口的 feature 开关，无需重新编译前端。

```js
window.__WEBAPP_CONFIG__ = {
  branding: {
    productName: "", // 留空时继续使用构建期 VITE_APP_TITLE
    shortName: "Workspace",
    adminName: "Admin Preset",
    adminSubtitle: "basic RBAC",
  },
  features: {
    adminGuide: true,
    mobileWorkQueue: false,
    auditLog: false,
    businessAttachments: false,
    printWorkspace: false,
    historyCenter: false,
  },
};
```

约束：

- 只接受代码注册过的字段和布尔开关；未知字段不会自动变成菜单或权限。
- `productName` 非空时覆盖构建期 `VITE_APP_TITLE`；留空保持已有初始化/构建配置兼容。
- 本文件是公开静态资源，禁止写密码、token、私有地址或任何 secret。
- feature 开关只决定入口和展示，不参与授权。管理员权限继续由服务端 RBAC 校验，普通用户业务动作继续由业务接口校验。
- 不允许仅把开关设为 `true` 就宣称能力已接入；必须先完成服务端真源、错误合同和浏览器回归。

## 移动工作队列合同

启用 `mobileWorkQueue` 后，普通用户登录态可访问 `/work-queue`。模板客户端调用用户 scope 下的 JSON-RPC `work_item` 域：

| 方法     | 请求重点                                          | 返回重点                                |
| -------- | ------------------------------------------------- | --------------------------------------- |
| `list`   | `view`: `pending` / `completed` / `risk` / `mine` | `data.items[]`                          |
| `detail` | `id`                                              | `data.item`，包括展示字段与当前允许动作 |
| `act`    | `id`、`action_key`、`expected_version`            | `data.receipt`                          |

列表项至少需要稳定的 `id`、`title`、`status`、`status_label`、`tone`、`updated_at` 与 `version`。详情可以返回：

- `description`
- `fields: [{ label, value }]`
- `actions: [{ key, label, confirm_text, tone }]`

动作回执可以返回 `id`、`message`、`processed_at`。`expected_version` 用于阻止用户基于过期详情覆盖新状态；派生服务端应在版本不一致时返回明确的业务冲突错误，并要求重新加载详情。

模板负责：

- 分类 URL、返回路径和移动端底部导航。
- 请求乱序保护，刷新时保留已经可读的数据。
- 空数据、接口失败、重试、动作确认、进行中禁用和结果回执。
- 业务名称优先、语义状态色、移动端触控尺寸与无横向溢出。

派生项目负责：

- 工作事项的唯一真源、岗位可见范围、状态机和动作合法性。
- 服务端鉴权、幂等或并发冲突处理、审计与事实写入。
- 将真实错误码接入统一错误码目录和中文错误翻译。
- 为自己的字段、异常、恢复和端到端链路补测试。

`/Users/simon/projects/webapp-template/web/src/mocks/jsonRpcMockServer.js` 中的工作事项只在显式开启 `VITE_ENABLE_RPC_MOCK=true` 的开发/浏览器门禁中使用，不是生产数据源，也不构成服务端实现。

## 可选扩展责任

以下开关用于初始化盘点和帮助页状态，模板不为它们伪造接口：

- `auditLog`：派生项目需要定义操作者、动作、对象、时间、结果与必要上下文；普通运行日志不能冒充审计台账。
- `businessAttachments`：业务单据拥有附件关系和权限；对象存储只保存文件实体。
- `printWorkspace`：打印数据快照、模板版本与业务单据真源必须明确，不能临时从当前列表列拼装。
- `historyCenter`：展示可追溯的业务事件或版本来源；前端缓存、操作提示和数据库更新时间都不能单独冒充历史事实。

只有接口、权限、异常恢复和测试都存在时，才应新增对应路由并打开开关。

## 派生项目初始化检查

1. 替换 `app-config.js` 的品牌名称；不需要后台时按 Admin preset 文档整体裁剪。
2. 确认是否保留注册、是否优先移动端、哪些用户端入口已经有正式接口。
3. 若启用移动工作队列，先实现 `work_item` 服务端合同和业务权限，再打开开关。
4. 按真实业务替换帮助说明、菜单和页面字段，不复制其他 ERP 的角色、流程或单据。
5. 执行 `pnpm lint`、`pnpm css`、`pnpm test`、`pnpm build` 和 `pnpm style:l1`；新增页面或交互时同步扩展 scenario list。

当前 `style:l1` 覆盖公开入口、主题持久化、登录/注册、管理员鉴权与旧权限快照恢复、后台桌面/移动导航、账号搜索与状态确认、角色权限折叠、帮助页、功能关闭态、移动工作队列动作回执和 404。它验证浏览器交互与布局，不替代派生项目服务端集成、目标部署或人工 UAT。
