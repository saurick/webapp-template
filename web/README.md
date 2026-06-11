# web 前端说明

## 目录结构（简版）

| 路径          | 职责                                             |
| ------------- | ------------------------------------------------ |
| `src/common/` | 通用认证、组件、hooks、状态、常量与工具函数      |
| `src/pages/`  | 首页、登录、注册、管理员登录与 admin preset 页面 |
| `src/mocks/`  | 本地 mock 与前端基线测试辅助                     |
| `src/assets/` | 图标等静态资源                                   |
| `public/`     | 静态公开资源                                     |
| `scripts/`    | 最小浏览器级样式回归等前端侧脚本                 |
| `build/`      | 构建产物，不作为日常开发真源                     |

日常开发入口优先关注 `src/`、`scripts/` 与 `public/`；`build/`、`output/` 更偏本地产物，不建议当成业务实现入口。

## 前后台入口边界

- 前台普通用户：`/`、`/login`、`/register`，只展示普通用户工作台、登录和注册，不提供后台登录或管理控制台入口。
- 后台管理员：`/admin-login`、`/admin-menu`、`/admin-accounts`、`/admin-rbac`，使用 antd admin preset 与独立管理员登录态。
- 两套登录态分别使用 `AUTH_SCOPE.USER` 与 `AUTH_SCOPE.ADMIN`，页面文案和导航也应保持分离，避免把普通用户入口和管理员入口放到同一页面。

## 启动与构建

```bash
cd /Users/simon/projects/webapp-template/web
pnpm install
pnpm start
```

默认地址：`http://localhost:5177`。该端口只用于本地 Vite 开发服务。

本地开发默认代理到 `http://127.0.0.1:8200`。如需临时连接其他后端，可设置 `VITE_API_PROXY_TARGET`，例如：

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:8200 pnpm start
```

```bash
cd /Users/simon/projects/webapp-template/web
pnpm lint
pnpm css
pnpm test
pnpm playwright:install
pnpm style:l1
pnpm build
```

- `pnpm style:l1` 是当前仓库最小浏览器级样式回归，会自动拉起本地 Vite 并覆盖首页、用户登录、注册、管理员登录，以及未登录访问 `/admin-menu` 的重定向。
- 当前后台 preset 使用 antd；antd 只进入管理员后台页面，不作为用户端页面的默认设计体系。
- 若本轮改动触达更复杂的后台页面、弹窗、表格或更多响应式状态，仍需在 `style:l1` 之外继续补针对性浏览器回归。
- `pnpm test` 当前只负责验证错误码常量与登录态错误分类这类最小前端基线；它不替代浏览器里的样式 / box 模型验收。

## 环境变量

- `VITE_BASE_URL`：前端部署基础路径
- `VITE_APP_TITLE`：页面标题，占位值建议在派生项目初始化时替换
- `VITE_ENABLE_RPC_MOCK`：是否启用本地 RPC mock
- `VITE_API_PROXY_TARGET`：本地 Vite `/rpc` 代理目标，默认 `http://127.0.0.1:8200`

环境文件：

- `/Users/simon/projects/webapp-template/web/.env.development`
- `/Users/simon/projects/webapp-template/web/.env.production`

说明：当前可执行 `cd /Users/simon/projects/webapp-template/web && pnpm test` 验证错误码常量与鉴权分类基线，执行 `pnpm style:l1` 验证首页与登录链路的最小浏览器级样式回归；若任务涉及更复杂页面，仍应继续补页面级回归。
