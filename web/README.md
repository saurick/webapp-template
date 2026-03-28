# web 前端说明

## 启动与构建

```bash
cd /Users/simon/projects/webapp-template/web
pnpm install
pnpm start
```

```bash
cd /Users/simon/projects/webapp-template/web
pnpm lint
pnpm css
pnpm test
pnpm build
```

- 当前仓库还没有固定的 `style:l1/l2/l3` 浏览器脚本入口；若本轮是前端样式、布局、图片、图标或表格展示任务，默认仍要补浏览器级回归，不能只跑 `lint/css/test`。
- `pnpm test` 当前只负责验证错误码常量与登录态错误分类这类最小前端基线；它不替代浏览器里的样式 / box 模型验收。

## 环境变量

- `VITE_BASE_URL`：前端部署基础路径
- `VITE_APP_TITLE`：页面标题，占位值建议在派生项目初始化时替换
- `VITE_ENABLE_RPC_MOCK`：是否启用本地 RPC mock

环境文件：

- `/Users/simon/projects/webapp-template/web/.env.development`
- `/Users/simon/projects/webapp-template/web/.env.production`

说明：当前可执行 `cd /Users/simon/projects/webapp-template/web && pnpm test`，验证错误码常量与鉴权分类基线未被破坏；若任务涉及样式 / 布局，仍应配合真实浏览器做页面级回归。
