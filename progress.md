## 2026-02-20
- 完成：删除 `/Users/simon/projects/webapp-template/web/link_node_modules.sh`，该脚本已不再使用。
- 下一步：无。
- 阻塞/风险：无。

## 2026-02-20
- 完成：修复 `web` 的两个 ESLint warning：`util.js` 中 `!=` 改为 `!==`，`AdminMenu` 去除 `window.confirm` 改为页面内二次确认交互，消除 `no-alert` 告警。
- 验证：执行 `pnpm --dir /Users/simon/projects/webapp-template/web lint`，当前无 warning。
- 下一步：后续新增确认交互优先使用页面内确认或组件弹层，避免再次触发 `no-alert`。
- 阻塞/风险：无。

## 2026-02-20
- 完成：修复 `/Users/simon/projects/webapp-template/web/tailwind.config.js` 的 `global-require` 告警，将插件 `require()` 从 `plugins` 数组内移动到文件顶部常量声明。
- 验证：`pnpm exec eslint tailwind.config.js` 通过。
- 下一步：后续新增 Tailwind 插件沿用顶部常量引用写法，避免再次触发 `global-require`。
- 阻塞/风险：无。

## 2026-02-20
- 完成：将根目录 `README.md` 规范为统一同构结构（项目简介、目录结构、快速开始、质量命令、门禁、文档索引、数据库迁移约束），与同目录仓库保持一致。
- 完成：保留模板项目差异内容（无前端 test 脚本说明）并归入统一章节。
- 下一步：后续若新增前端 test 脚本，需同步更新根 README 的质量命令说明。
- 阻塞/风险：无。

## 2026-02-20
- 完成：按统一规范重写根目录 `README.md`（项目简介、目录结构、快速开始、质量命令、门禁说明、文档索引），并补齐缺失的 `web/README.md`。
- 完成：规范化 `server/README.md`，修复代码块围栏不闭合导致的渲染问题；新增 `docs/README.md` 说明根级 docs 定位。
- 下一步：后续新增脚本或模块文档时，保持“目录就近 + 根 README 索引”同步更新。
- 阻塞/风险：无。

## 2026-02-19
- 完成：按目录就近原则，将脚本文档从 `/Users/simon/projects/webapp-template/docs/qa-scripts.md` 调整为 `/Users/simon/projects/webapp-template/scripts/README.md`，与目录就近文档风格一致。
- 完成：同步更新 `README.md` 中脚本文档入口链接，避免路径失效。
- 下一步：后续脚本行为变更优先维护 `scripts/README.md`，并保持三个仓库同构。
- 阻塞/风险：无。

## 2026-02-19
- 完成：为 6 项本地质量脚本补充统一可读文档 `/Users/simon/projects/webapp-template/docs/qa-scripts.md`，覆盖作用、执行时机、环境变量、失败处理与 hook 映射。
- 完成：6 项脚本增加 `-h/--help` 说明，支持终端快速查看用途与参数，降低脚本心智负担。
- 完成：`README.md` 补充 `docs/qa-scripts.md` 入口，避免脚本说明散落。
- 下一步：后续如增加新门禁脚本，先补 `docs/qa-scripts.md` 再纳入 hooks。
- 阻塞/风险：无。

## 2026-02-19
- 完成：同步接入本地 Git hooks 方案（`.githooks` + `scripts/git-hooks` + `scripts/setup-git-hooks.sh`），用于无 CI 场景的自动质量门禁。
- 完成：`pre-commit` 已配置为仅处理暂存的 `web/` 文件（`prettier` + `eslint --fix`），`pre-push` 已配置为执行 `web lint/css/test(若存在)/build` 与 `server go test/build`。
- 完成：更新 `README.md` 增加 hooks 启用与使用说明，并执行安装与校验命令。
- 下一步：按常规 `git commit`/`git push` 流程使用 hooks；如需紧急放行可临时使用 `SKIP_PRE_PUSH=1 git push`。
- 阻塞/风险：`pre-push` 全量检查耗时较长，首次执行受依赖安装与机器性能影响。

## 2026-02-15
- 完成：同步部署稳定性与迁移友好逻辑：配置改为服务名互联、compose 增加 MySQL healthcheck + depends_on 条件、增加 `.env.example`、文档补充迁移步骤（`server/configs/*`、`server/deploy/compose/prod/*`）。
- 完成：数据层新增 MySQL 启动重试窗口与单测，降低宿主机重启后数据库短暂未就绪导致的启动失败（`server/internal/data/data.go`、`server/internal/data/data_ping_retry_test.go`）。
- 下一步：部署前按目标机器复制 `.env.example` 为 `.env` 并校准路径/端口/镜像，再执行 `docker compose up -d`。
- 阻塞/风险：仓库存在大量既有前端未提交改动（与本次同步无关）；提交时需严格按文件范围选择，避免混入。
