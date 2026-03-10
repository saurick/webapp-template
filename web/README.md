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
pnpm build
```

## 环境变量

- `VITE_BASE_URL`：前端部署基础路径
- `VITE_APP_TITLE`：页面标题，占位值建议在派生项目初始化时替换
- `VITE_ENABLE_RPC_MOCK`：是否启用本地 RPC mock

环境文件：

- `/Users/simon/projects/webapp-template/web/.env.development`
- `/Users/simon/projects/webapp-template/web/.env.production`

说明：当前可执行 `cd /Users/simon/projects/webapp-template/web && pnpm test`，验证错误码常量与鉴权分类基线未被破坏。
