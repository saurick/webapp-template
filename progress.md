## 归档索引

- 2026-03 及更早历史流水：`docs/archive/progress-2026-03.md`。
- 2026-04 到 2026-05-03 早前流水快照：`docs/archive/progress-2026-04-to-2026-05-03-pre-admin-preset.md`。
- 当前文件只保留近期活跃事项和后续新增记录；归档文件只作追溯线索，不作为当前正式真源。

## 2026-06-15 21:50 CST

- 完成：新增 `scripts/deploy/production-preflight.sh` 和 `server/Makefile` 的 `production_preflight` 入口，作为 Compose 单机发布前门禁；检查运行时 `.env`、占位 secret、镜像 tag、Compose 禁止 `build:`、Jaeger loopback、宿主机 Atlas migration 和可选运行态 `/healthz` / `/readyz`。
- 完成：将 prod Compose 的 Jaeger 端口默认收口到 `JAEGER_BIND_ADDR=127.0.0.1`，并把 `WEBAPP_JWT_SECRET` 纳入运行时 env 注入和 `.env.example`。
- 完成：同步 `scripts/README.md` 与 `server/deploy/compose/prod/README.md` 的 preflight 入口说明。
- 验证：`bash scripts/deploy/production-preflight.sh --example` 通过；`.env.example` 作为生产 env 被 placeholder 门禁阻断；临时非占位 env 通过静态 preflight；`make -n production_preflight`、`bash scripts/qa/secrets.sh`、`git diff --check` 通过。
- 下一步：真实发布前先替换 `server/deploy/compose/prod/.env` 并执行 `cd server && make production_preflight`；部署后追加 `--runtime` 留存运行态证据。
- 阻塞/风险：本轮未连接真实生产 `.env` 或运行中 Compose，因此没有执行 `--runtime`。

## 2026-06-11 saurick demo 白屏修复

- 完成：修复 `https://webapp-template.saurick.me/` 首页空白页。根因是 `web/vite.config.mjs` 的手动 `manualChunks` 产生 `vendors -> vendor -> admin-vendor -> vendors` 循环依赖，`admin-vendor` 在 React exports 初始化前执行 `createContext` 导致首屏启动失败；已删除这段手动分包，让 Vite/Rollup 按真实依赖图拆包。
- 完成：同步修正 Docker web-builder 未复制 `web/.env.production` 的问题，避免镜像内 `index.html` 保留 `%VITE_APP_TITLE%` 占位标题；重新构建并部署镜像 `webapp-template-server:20260611T165112-2b036589-local` 到 133，当前 `webapp-template-demo-server` 已使用该版本运行。
- 验证：本地执行 `cd web && pnpm build`，产物首页不再 preload 旧的 `admin-vendor/vendor/vendors` 三角依赖；`cd web && pnpm style:l1` 通过 10 个浏览器场景；`cd web && pnpm lint && pnpm css && pnpm test` 通过；`git diff --check` 与 `bash scripts/qa/fast.sh` 通过。
- 验证：133 上 `curl http://127.0.0.1:8500/healthz` 返回 `ok`，`/readyz` 返回 `ready`；公网 `https://webapp-template.saurick.me/` 返回新 `index.html` 与 `Project Workspace` 标题；in-app Browser 打开公网首页已渲染“项目工作台 / 欢迎回来，访客”，console error/warn 为空。
- 验证：发布后执行 `docker image prune -a -f` 与 `docker builder prune -f`，回收旧 `20260611T154843` 镜像约 `42.14MB`；清理后 `/` 分区仍为 `98G/24G/70G/26%`，`docker system df` 显示镜像 `19/19 active`、可回收 `0B`，`webapp-template-demo-*` 与 `home-nav` 容器状态正常。
- 下一步：如需把本轮部署修复纳入版本库，等待用户确认后再提交 / 推送；home-nav 的 `sun-64-webapp-template` runtime 配置仍在 133 的 `/opt/home-nav/services.yaml`，未写入本仓。
- 阻塞/风险：未使用真实管理员账号完整回归后台登录后的表格页面；本轮已通过生产构建、首页浏览器回归和本地 `style:l1` 覆盖默认页、登录页、注册页与未登录后台重定向。

## 2026-06-11 133 demo 部署

- 完成：将 `webapp-template` 作为隔离 demo 实例部署到 `192.168.0.133`，远端目录为 `/opt/webapp-template-demo`，数据目录为 `/data/webapp-template-demo/postgres`，容器组为 `webapp-template-demo-{server,postgres,jaeger}`；应用端口使用 `8500/9500`，PostgreSQL 使用 `5436`，Jaeger 使用独立端口组，避免和现有 `openai-oauth-api-service / plush-toy-erp / trade-erp / home-nav` 冲突。
- 完成：本地构建并上传镜像 `webapp-template-server:20260611T154843-2b036589-local`，远端只执行 `docker load`、Compose 启动、宿主机 Atlas migration 与健康检查；未在 133 上执行构建命令。部署过程中修正 `server/Dockerfile` 与 `server/Makefile` 的构建基线：Go builder 从 `golang:1.25.9` 同步到 `golang:1.25.11`，并固定 `PNPM_VERSION=10.13.1`，避免 Docker build 漂到最新 pnpm 后阻断 `esbuild` build script。
- 完成：133 新增 `frpc-saurick-webapp-template`，映射 `127.0.0.1:8500 -> 8.218.4.199:18224`；8.218.4.199 的 active `/etc/frp/frps.toml` 已允许 `18224`，`/etc/nginx/conf.d/saurick-tools.conf` 已新增 `webapp-template.saurick.me -> saurick_18224`，共享证书覆盖 `*.saurick.me`。
- 验证：`BUILD_TIME=20260611T154843 FIXED_TAG=saurick-demo make build_server` 通过；133 上 `migrate_online.sh --apply` 已应用到 `20260503143604`；`curl http://127.0.0.1:8500/healthz` 返回 `ok`，`/readyz` 返回 `ready`，首页返回 `200`；强制解析 `webapp-template.saurick.me:443 -> 8.218.4.199` 时，严格 TLS 校验通过，`/healthz` 返回 `ok`，`/readyz` 返回 `ready`，首页返回 `200`，HTTP 80 会 301 到 HTTPS；Cloudflare DoH 已返回 `webapp-template.saurick.me A 8.218.4.199`；`git diff --check` 与 `bash scripts/qa/fast.sh` 通过。
- 验证：发布后按低配宿主机约定执行 `docker image prune -a -f` 与 `docker builder prune -f`，清理前后 `/` 分区均为 `98G/24G/70G/26%`，`docker system df` 显示镜像 `19/19 active`、可回收 `0B`，builder cache `0B`，运行容器未受影响。
- 下一步：部署入口已接入 home-nav；若后续需要长期保留 demo，应再决定是否提交本仓构建修复和是否把 home-nav runtime 配置同步回其代码仓。
- 阻塞/风险：首次部署后的白屏问题已在同日后续记录修复；当前仍未把 133 的 home-nav runtime 配置写入本仓。

## 2026-06-04 Go 漏洞依赖升级

- 完成：修复 `govulncheck` 可达漏洞告警，升级 `server/go.mod` 的 Go patch 指令到 `1.25.11` 并显式固定 `toolchain go1.26.4`，同步升级 `go.opentelemetry.io/otel/*` 到 `v1.43.0`、`golang.org/x/net` 到 `v0.53.0` 及相关间接依赖。未改模板初始化规则、部署路径、schema、迁移、前端页面或可观测性代码逻辑。
- 验证：已执行 `bash scripts/qa/govulncheck.sh`，结果为 0 个可达漏洞；已执行 `cd server && go test ./...`，通过。
- 下一步：后续模板派生项目可继承当前安全依赖基线；若项目需要继续保守 Go 语言版本，可保留 `go 1.25.11` 并通过 `toolchain` 固定扫描和构建工具链。
- 阻塞/风险：本轮只处理服务端 Go 依赖安全更新；未运行前端 `style:l1`，因为未触达前端样式、页面或浏览器交互。

## 2026-05-29 23:07

- 完成：收口派生项目初始化时的默认管理员密码真源。服务端移除 `WEBAPP_ADMIN_USERNAME` / `WEBAPP_ADMIN_PASSWORD` 运行时覆盖入口，prod-trial Helm values、Argo 清单、runtime Secret 示例和 SealedSecret 不再注入管理员账号密码；管理员登录口径回到 `config.yaml` / `config.local.yaml` 的 `data.auth.admin`。同步更新 `docs/project-init.md`、`scripts/init-project.sh`、`server/docs/config.md`、`server/docs/k8s.md`、`server/deploy/dev/configmap.yaml` 和 `server/deploy/lab-ha/docs/PROD_TRIAL.md`，明确初始化时不要生成随机环境变量覆盖管理员密码。
- 下一步：若后续派生项目确需修改默认管理员密码，应直接改对应环境配置并在交付说明里写明登录口径；不要恢复 `WEBAPP_ADMIN_PASSWORD` 这类静默覆盖入口。
- 阻塞/风险：本轮只收口模板代码和部署清单，未修改数据库已有管理员记录；如果某个已运行环境此前已经用随机 env 初始化过管理员，需要按该环境的实际数据单独重置或清理。

## 2026-05-23 17:24

- 完成：收口 lab-ha 生产试验 runtime Secret 示例中的管理员初始密码口径，`admin_username` 保持 `admin`，`admin_password` 改为明确的 `adminadmin`，避免派生部署时按示例生成不可预期的随机登录密码；`jwt_secret` 也改为显式占位，表达必须人工设定而不是脚本暗自随机生成。
- 下一步：若后续继续完善模板部署脚本，应保持管理员初始密码可预期、可覆盖，不在部署过程中静默随机生成。
- 阻塞/风险：本轮仅调整示例 Secret 文档口径，未触达运行代码、schema、migration 或 live 环境；真实生产部署仍应在交付清单里显式确认密码是否需要按甲方要求修改。

## 2026-05-13 22:14

- 完成：将 Compose 模板的线上 Atlas migration 规则收口到 `AGENTS.md`、`docs/deployment-conventions.md`、`server/deploy/README.md` 和 `server/deploy/compose/prod/README.md`：低配服务器使用宿主机 `/usr/local/bin/atlas` 与 `flock /tmp/atlas-migrate.lock`，禁止 `arigaio/atlas:*` 临时容器和 Compose 内 Atlas。
- 完成：`server/deploy/compose/prod/migrate_online.sh` 已从 Docker Atlas 容器改为宿主机 Atlas 执行，默认从 PostgreSQL 容器端口绑定推导宿主机端口，支持 `ATLAS_BIN / POSTGRES_HOST_PORT / MIGRATION_LOCK_FILE` 覆盖，后续派生项目不会继续生成 Atlas Docker 迁移主路径。
- 下一步：如继续完善模板发布脚本，可把远端 Atlas 版本检测、端口可达性和 migration lock 纳入 `publish_server.sh` preflight。
- 阻塞/风险：本轮未连接任何线上库执行 migration，只更新模板规则、runbook 和脚本主路径；已派生出去但未同步模板更新的老项目仍需单独收口。

## 2026-05-10 00:30

- 完成：补充 `AGENTS.md` 的多项目低配 Docker 宿主机发布后清理约束，明确发布完成、健康检查和必要回归通过后，只清理未被任何容器使用的旧镜像与构建缓存，优先使用 `docker image prune -a -f` 与 `docker builder prune -f`；清理前后记录磁盘、Docker 占用和运行容器状态，并禁止清理 volume、数据库目录、compose `.env`、上传目录或运行中容器依赖镜像。
- 下一步：如后续继续完善模板发布脚本，可将该约束落为 post-deploy cleanup，并保留必要回滚镜像边界。
- 阻塞/风险：本轮只更新协作约束文档，未修改运行代码、部署脚本或线上服务。

## 2026-05-09 12:59

- 完成：将本地前端 Vite 开发端口从 `5175` 顺延到 `5177`，并开启 `strictPort`，避免与 `trade-erp`、`collision-simulator`、`plush-toy-erp` 和 `openai-oauth-api-service` 的本机开发端口互抢；同步更新根 README 与前端 README。
- 验证：已检查 `progress.md` 规模，未达到归档阈值；`git diff --check` 通过；临时启动 Vite 到 `http://127.0.0.1:5177/`，`curl -I` 返回 `HTTP/1.1 200 OK`，验证后已停止该临时进程。本轮仅改本地 Vite 配置和文档，未触达服务端 schema、migration、生产 Compose、K8s 或 lab-ha 配置。
- 下一步：本地启动模板前端使用 `cd /Users/simon/projects/webapp-template/web && pnpm start`，访问 `http://localhost:5177`；后端仍使用 `8200/9200`。
- 阻塞/风险：当前工作区已有大量未提交的其他改动，本轮只在既有文件上追加端口相关修改；若外部脚本或浏览器书签仍写死 `5175`，需同步改到 `5177`。

## 2026-05-08 23:59

- 完成：按低配服务器发布口径补充模板部署构建边界，更新 `AGENTS.md`、`docs/deployment-conventions.md`、`server/deploy/README.md` 和 `server/deploy/compose/prod/README.md`，明确 Compose 单机部署默认本地或 CI 构建、打包、上传，服务器只负责加载镜像、启动服务、migration 与部署后检查。
- 验证：本轮为部署文档和协作规则改动，未触达运行时代码、schema、模板脚本或 live 环境；更新前已检查 `progress.md` 规模，未达到归档阈值。
- 下一步：派生项目复用 Compose 发布模板时，继续保留 `publish_server.sh` 的本地构建主路径，不把低配服务器作为构建机。
- 阻塞/风险：本轮未新增脚本级强制校验；约束先落在模板正式文档和 AGENTS，防止后续派生项目误把服务器构建当默认流程。

## 2026-05-04 18:27

- 完成：优化首页视觉层级，仅调整 `/Users/simon/projects/webapp-template/web/src/pages/Home/index.jsx`。保留现有用户登录、注册、管理员入口、登录态判断和跳转逻辑，移除原先过重的嵌套 `SurfacePanel` 结构，改成左侧欢迎面板 + 右侧入口卡片的轻量首屏；入口卡片增加顶部状态色带、按钮阴影和更清晰的已登录 / 未登录层级，移动端按单列自然堆叠。
- 完成：顺手收掉首页外层 `py` 与 `min-h-screen` 叠加造成的宽屏多余纵向滚动；未调整仓库目录结构、路由、认证、错误码、接口或部署口径，因此无需同步 README / docs 目录说明。
- 验证：`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm style:l1` 通过；`style:l1` 已覆盖首页桌面、首页移动、登录、注册、管理员登录、未登录后台重定向、已登录后台控制台、账号目录和移动端 RBAC。另用 Playwright 在 `2048x1024` 宽屏管理员已登录态抓图并检查 box 指标，`bodyScrollWidth` / `documentElement.scrollWidth` 均等于 viewport 宽度，无横向溢出。
- 下一步：如果后续要继续提升首页，可再引入项目真实品牌、产品截图或业务数据；当前仍保持模板默认中性视觉，不提前绑定行业主题。
- 阻塞/风险：本轮只优化首页视觉，未改登录页、注册页和后台页面的视觉体系；这些页面只通过现有回归确认没有被首页改动带坏。

## 2026-05-04 21:38

- 完成：修复后台 `admin/adminadmin` 登录成功但前端无法落登录态的问题。根因是 `auth.admin_login` 新增 `roles` / `permissions` 后把 `[]string` 直接传给 `structpb.NewStruct`，导致 JSON-RPC 响应 `data=null`；已在 `/Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go` 的统一 `newDataStruct` helper 中收口 slice 转换，并补充管理员登录返回 token 与权限数组的回归测试。
- 完成：确认开发库迁移状态为最新，`admin` 未禁用且已绑定 `super_admin` 及内置权限；重建并重启本地 `./bin/server-dev` 后，`auth.admin_login` 与 `auth.me` 均能返回 `access_token`、`roles`、`permissions`。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./internal/data` 通过；`cd /Users/simon/projects/webapp-template/server && go test ./...` 通过；`curl http://127.0.0.1:8200/rpc/auth` 验证 `admin_login` 返回非空 `data`，再带 token 调 `auth.me` 返回 `super_admin` 和 4 个默认权限。
- 下一步：若后续继续扩展 JSON-RPC 返回复杂结构，优先复用当前 helper 或补充对应类型转换测试，避免在接口分支里各自处理。
- 阻塞/风险：当前只修复服务端响应构造和本地开发服务；前端代码未改。若浏览器里仍停留在旧失败态，清掉当前页面错误提示或刷新后重新登录即可。

## 2026-05-04 22:25

- 完成：修复后台菜单因旧管理员登录态缺少 `roles/permissions` 而只显示“控制台”的残值问题。新增管理员登录态变更事件与 `useCurrentUser(...)`，后台 Layout 在检测到“token 有效但权限快照为空”时自动调用 `auth.me` 回补服务端权限真源，并通知控制台、账号目录等页面重新渲染。
- 完成：调整前端路由权限保护的旧态兼容逻辑：当管理员 token 存在但权限快照尚未回补时，不立即把有权限页面重定向回控制台；服务端仍是最终权限边界，前端只负责菜单和页面显示保护。
- 完成：在 `web/scripts/styleL1.mjs` 固化 `admin-menu-stale-auth-recovers` 浏览器场景，模拟旧 token 无权限快照，验证进入后台后能恢复 `super_admin`、账号目录、角色权限和本地 `admin_permissions`。
- 验证：`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test` 通过；`cd /Users/simon/projects/webapp-template/web && pnpm style:l1` 通过，共验证 10 个浏览器场景；另用真实本地页面 `http://127.0.0.1:5176/admin-menu` + 8200 后端复现旧 token 无权限快照，确认菜单、`super_admin` 与本地 `admin_permissions` 自动恢复且无横向溢出。
- 下一步：若后续继续新增管理员资料字段，优先沿用 `auth.me` 回补快照，不要在各页面散落本地存储兼容逻辑。
- 阻塞/风险：本轮没有改变服务端权限判定；前端恢复依赖当前 token 仍有效且 `auth.me` 可访问。若 token 本身已过期，仍会按既有逻辑跳回管理员登录页。

## 2026-05-06 21:57

- 完成：彻底定位后台反复登录失败的主因不是 `admin/adminadmin` 本身，而是端口误连。当前本机 `8200` 被 `/Users/simon/projects/openai-api-gateway/server` 占用，`webapp-template` 前端原先也代理到 `8200`，导致登录请求发给了另一个项目后端并返回“密码错误”。
- 完成：把 `webapp-template` 本地开发后端端口从 `8200/9200` 改为项目专属 `18200/19200`，同步更新 `server/configs/dev/config.yaml`、`server/Makefile`、`web/vite.config.mjs`、README、后端 runtime 文档和本地压测默认 `BASE_URL`。Vite `/rpc` 默认代理现在指向 `http://127.0.0.1:18200`，也可通过 `VITE_API_PROXY_TARGET` 显式覆盖。
- 完成：已实际重启本仓库后端到 `18200`，并重启本仓库前端到 `5176`；保留其他项目占用的 `8200/5177`，不再互相抢端口。
- 完成：补强旧 token 处理。`AuthGuard` 改为监听登录态变化；后台 Layout 在 `auth.me` 判定 token 失效时会清空管理员登录态并跳回 `/admin-login`，避免残留其他项目签发的 token 后继续停在半残后台。
- 验证：`curl http://127.0.0.1:18200/readyz` 返回 `ready`；直接调用 `18200/rpc/auth admin_login` 返回 `code=0`、token 和 4 个默认权限；真实浏览器打开 `http://127.0.0.1:5176/admin-login`，用 `admin/adminadmin` 登录后进入 `/admin-menu`，可见“控制台 / 账号目录 / 角色权限”；另用伪造的旧 admin token 访问 `/admin-accounts`，已自动清 token 并回到 `/admin-login`。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./...` 通过；`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm build && pnpm style:l1` 通过。
- 下一步：后续本地同时打开多个派生项目时，先检查 `lsof -nP -iTCP:<端口>`，不要把不同仓库继续共用同一个 API 端口。若派生项目确实要改端口，优先改各自 `configs/dev/config.yaml` 与 `VITE_API_PROXY_TARGET`，并同步文档。
- 阻塞/风险：当前 8200 仍由 `openai-api-gateway` 占用，这是其他项目进程，不属于本仓库问题；`webapp-template` 已不再依赖 8200。

## 2026-05-06 22:14

- 完成：按用户明确要求，把 `webapp-template` 本地开发端口口径改回 `8200/9200`。同步恢复 `server/configs/dev/config.yaml`、`server/Makefile`、`web/vite.config.mjs`、README、`server/docs/runtime.md`、`web/README.md` 和本地压测默认 `BASE_URL`，保留 `VITE_API_PROXY_TARGET` 作为临时覆盖入口。
- 完成：已停掉上一轮为本仓库启动的旧 `18200/5176` 开发进程，避免继续访问旧代理配置。当前 8200 仍由 `/Users/simon/projects/openai-api-gateway/server` 占用，本轮未动该项目进程；需要先把那边切到 8300 或停止后，本仓库才能重新绑定 8200。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./...` 通过；`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm build && pnpm style:l1` 通过。
- 下一步：用户把 `openai-api-gateway` 改到 `8300` 并释放 8200 后，在本仓库执行 `cd /Users/simon/projects/webapp-template/server && make run`，再执行 `cd /Users/simon/projects/webapp-template/web && pnpm start`。
- 阻塞/风险：在 8200 未释放前，`webapp-template` 后端不能按当前配置启动；如果此时启动前端并登录，仍会打到当前占用 8200 的其他项目后端。

## 2026-05-03 22:55

- 完成：把模板后台正式收口为可选 `admin preset` 形态，并新增 `/Users/simon/projects/webapp-template/docs/admin-preset.md` 作为 antd 后台与 basic RBAC 边界文档。根 README、`docs/README.md`、`docs/current-source-of-truth.md`、`docs/project-init.md`、`web/README.md`、`server/docs/api.md`、`server/internal/biz/README.md` 和 `scripts/init-project.sh` 已同步更新，明确 base 与 admin preset 两种初始化形态。
- 完成：后端新增 basic RBAC 真源。新增 `server/internal/biz/rbac.go`、`admin_roles`、`admin_permissions`、`admin_user_roles`、`admin_role_permissions` Ent schema、迁移 `20260503143604_migrate.sql` 和生成的 Ent 代码；默认管理员启动初始化会幂等写入 `super_admin`、默认权限码和绑定关系。`auth.admin_login` / `auth.me` 返回 `roles` 与 `permissions`，`user.list`、`user.set_disabled`、`rbac.overview` 现在由服务端按权限码校验。
- 完成：前端新增 antd 后台 preset。已引入 `antd` 与 `@ant-design/icons`，新增后台 Layout、RBAC 概览页、权限常量、管理员权限持久化和菜单/路由显示控制；账号目录改为 antd Table；`/admin-guide` 兼容重定向到 `/admin-rbac`；Vite 将 antd 拆成 `admin-vendor`，避免用户端首屏默认加载后台依赖。
- 完成：补强浏览器级样式回归。`pnpm style:l1` 现在覆盖首页、用户登录、注册、管理员登录、未登录后台重定向、已登录后台控制台、账号目录和移动端 RBAC；修复了移动端 RBAC 表格横向溢出，让宽表在卡片内部滚动。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./...` 通过；`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm build && pnpm style:l1` 通过；`bash scripts/qa/fast.sh` 通过；`cd /Users/simon/projects/webapp-template/server && make migrate_apply && make migrate_status` 已把开发库更新到 `20260503143604` 且 pending 为 `0`。
- 下一步：若后续要把 basic RBAC 扩成可编辑权限后台，优先在派生项目里补角色创建、角色授权和管理员分配；模板主干暂不内置多租户、部门树、数据权限、字段级权限、审批流权限或行业角色。
- 阻塞/风险：默认 RBAC 数据由服务启动初始化写入；本轮已迁移开发库 schema，但默认角色权限数据需要服务启动时执行 `InitAdminUsersIfNeeded` 才会写入 live 数据库。当前模板只提供 basic RBAC，不覆盖项目特有权限策略。

## 2026-05-03 18:41

- 完成：收紧 `/Users/simon/projects/webapp-template/AGENTS.md` 中的 `progress.md` 归档规则，明确每次更新前先检查规模；达到或超过 `600` 行或 `80KB` 时，必须先显式归档旧记录再追加本轮记录，并禁止通过 pre-commit、pre-push 或后台脚本静默自动改写。本轮只更新协作规则和本进度记录，不改变模板正式规则、部署口径、运行时代码或既有归档文件。
- 下一步：后续更新 `progress.md` 时按 `600` 行 / `80KB` 双阈值执行；阶段完成或历史内容影响查找时，可提前人工归档。
- 阻塞/风险：本轮未新增检查脚本或提交钩子，避免自动改写工作区；归档仍由当前执行者按规则显式完成。

## 2026-05-03 18:05

- 完成：写入 `progress.md` 人工归档规则，并按规则归档历史流水。当前 `progress.md` 保留 `2026-04-01` 以来的近期事项；`2026-03-31` 及以前历史流水已移动到 `/Users/simon/projects/webapp-template/docs/archive/progress-2026-03.md`。同步更新 `/Users/simon/projects/webapp-template/docs/README.md`，把 `docs/archive` 作为过程流水归档入口。
- 下一步：后续继续按阶段或文件明显变大时人工归档；ignored 的 `output/`、`web/output/`、`.playwright-cli/`、`tmp/`、`server/bin/` 等本地产物另按产物清理处理，不纳入正式文档归档。
- 阻塞/风险：本轮只调整协作规则与过程流水归档，不改变模板正式规则、部署口径、运行时代码或测试样本。归档文件只作历史追溯线索，不作为当前模板真源。

## 2026-05-06 22:15

- 完成：按用户给的浅色后台参考风格重做主页、用户登录/注册、管理员登录和后台 shell 的视觉基调。公共 `AppShell` 改为浅蓝到米白背景与细横线纹理，`SurfacePanel` 改为白底薄边低阴影；主页卡片、入口按钮、表单输入、后台侧栏、后台卡片、表格表头和 antd 主按钮统一到海军蓝、金色、绿色与浅绿侧栏体系。业务路由、认证、接口、错误码和页面文案主路径未改。
- 完成：后台移动端回归时发现长管理员名会把 header 右侧 antd `Space` 撑出 390px 视口，已在 `adminLayout.css` 收口 header 可收缩、用户名省略和移动端右侧区域布局，修复横向滚动风险。未调整目录结构，不需要更新目录说明文档。
- 验证：`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm style:l1` 通过；另用 Playwright 生成并查看临时截图，覆盖桌面/移动主页、管理员登录、已登录后台控制台，注入超长管理员名和长密码，检查 `scrollWidth`、关键 box 尺寸、用户名省略、后台退出弹窗打开/取消，结果无横向溢出；临时截图和指标文件已移入废纸篓。
- 下一步：如果后续要更贴近具体品牌，可再替换真实 logo、品牌名和后台业务导航；本轮只做风格层，不引入行业内容。
- 阻塞/风险：内置浏览器可读取 DOM，但截图接口本轮超时，因此视觉截图与盒模型断言使用仓库 Playwright fallback 完成；未单独覆盖账号目录/RBAC 的全部表格数据状态，仍由 `style:l1` 的既有场景负责最小回归。

## 2026-05-10 23:59

- 完成：把 `lab-ha` 公网入口从 `saurick.space` 迁到 `saurick.me`。已更新 Cloudflare `saurick.me` DNS：`lab.saurick.me` 维护到 `lab-edge / 192.168.0.9` 当前 IPv6，`portal / observer / ddns / app / preview / harbor / headlamp / alertmanager / longhorn / hubble / seaweedfs / alertsink / s3 / argocd` 等入口通过 `CNAME -> lab.saurick.me` 复用同一条链路。
- 完成：已 SSH 到 `lab-edge` 修改 live `/etc/ddns-go/lab-saurick.yaml`，让 `ddns-go` 维护 `lab.saurick.me`；修改并重启 live `/etc/caddy/Caddyfile`，Caddy 已为新域名签发 Let's Encrypt 证书。由于 `gitlab / grafana / jaeger / prometheus.saurick.me` 被另一套 `saurick.me` DDNS 自动改回旧 IPv6，本轮将 HA lab 对应入口收口为 `lab-gitlab / lab-grafana / lab-jaeger / lab-prometheus.saurick.me`，避免和现有服务抢同名记录。
- 完成：同步仓库真源和 runbook：更新 `server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile`、`server/deploy/lab-ha/manifests/platform-portal.yaml`、`server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`、`server/deploy/lab-ha/docs/ACCESS.md`、`DDNS_GO.md`、`LAB_EDGE.md`、`LAB_OBSERVER.md`、`PUBLIC_GATEWAY.md`、`README.md`、`VM_POWER_SEQUENCE.md` 和 `scripts/loadtest/README.md`，并明确 `lab-` 前缀入口的冲突原因。
- 验证：Cloudflare API 已确认 `saurick.me` zone 可访问；`caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` 通过；`systemctl restart caddy` 后 `caddy` 与 `lab-edge-ddns-go` 均为 `active`；Caddy 日志显示 `portal/app/preview/ddns/observer/lab-gitlab/lab-grafana/lab-jaeger/lab-prometheus` 等证书已签发。`curl -6 --noproxy '*'` 验证 `portal/app/preview/observer/healthz/ddns/lab-gitlab/lab-grafana/lab-prometheus` 均返回 `200` 且 TLS 校验为 `0`；`lab-gitlab` 响应头已带 `_gitlab_session ... Domain=.saurick.me`；`lab-jaeger` 强制解析到 edge 时返回 `200` 且 TLS 正常，公共解析仍在本机 resolver 侧传播。
- 下一步：若要让 Portal live 页面立即使用新外链，需要发布 `lab-platform`；本轮已更新 Helm raw 与 manifest 真源，但未执行 Argo/Helm 发布。后续若另一套 `saurick.me` DDNS 停用，可再评估是否把 `lab-gitlab/lab-grafana/lab-jaeger/lab-prometheus` 改回无前缀主机名。
- 阻塞/风险：`gitlab/grafana/jaeger/prometheus.saurick.me` 当前仍被外部 DDNS 占用，不能作为 HA lab 稳定入口；`lab-jaeger.saurick.me` 在 Cloudflare DoH/API 和强制 edge 验证正常，但本机普通 resolver 暂时仍解析不到，需等 DNS 缓存传播或刷新本机 DNS。

## 2026-05-11 00:06

- 完成：补齐 `lab-edge` Caddy 更新口径。`PUBLIC_GATEWAY.md` 已明确说明 live Caddyfile 顶部配置 `admin off`，因此 `systemctl reload caddy` 会因为本地 admin API 关闭而失败；更新 host map、反代目标或证书入口时固定走 `caddy validate` 后 `systemctl restart caddy`。`LAB_EDGE.md` 也新增“更新 Caddy 配置”小节，写清 `validate / restart / is-active` 三步。
- 验证：`rg` 已确认 `reload caddy` 只作为“不要使用”的说明出现，正式命令口径均为 `systemctl restart caddy`；`git diff --check -- server/deploy/lab-ha/docs/PUBLIC_GATEWAY.md server/deploy/lab-ha/docs/LAB_EDGE.md` 通过。
- 下一步：若要让 Portal live 页面显示新 `saurick.me` 外链，继续按 `lab-platform` Helm/Argo 主路径发布；本轮只修正文档和 runbook，不动 live 服务。
- 阻塞/风险：无新增 live 风险；当前仍保留上一条记录里的 `lab-jaeger.saurick.me` 本机 resolver 传播盲区，以及无前缀 `gitlab/grafana/jaeger/prometheus.saurick.me` 被另一套 DDNS 占用的边界。

## 2026-06-11 13:47

- 完成：按 Product Design 分离版视觉目标重做前端原型。`/`、`/login`、`/register` 收口为普通用户工作台与前台登录注册，不再展示管理员入口；`/admin-login`、`/admin-menu`、`/admin-accounts`、`/admin-rbac` 收口为独立后台原型，后台控制台集中展示账号目录、RBAC、健康检查、错误码治理、QA 命令和 Compose / lab-ha 部署边界。
- 完成：保留真实认证与 RPC 主路径，只补强 `VITE_ENABLE_RPC_MOCK=true` 下的本地 dev mock 数据，方便原型预览看到完整账号表和 RBAC 数据；同步更新 `README.md`、`web/README.md`、`docs/admin-preset.md` 里的前后台入口边界，并新增 `design-qa.md` 记录 Product Design QA 结论。
- 验证：`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm style:l1 && pnpm build` 通过；`style:l1` 已覆盖 10 个场景，并新增前后台入口负向断言；浏览器实测 `/admin-login` 通过表单登录进入 `/admin-menu`，前台页面无 `管理员登录`，后台页面无 `注册账号`，1440px 下关键页面无横向溢出，后台卡片标题无裁切。
- 下一步：若后续要继续提升产品化展示，可按真实派生项目的品牌、业务首页和后台菜单替换当前模板级 mock 文案与静态模块。
- 阻塞/风险：本轮只重做前端原型与本地 mock 数据，不新增后端业务接口、不改变服务端权限真源，也未发布到线上环境；运行中的本地预览使用 `VITE_ENABLE_RPC_MOCK=true`，仅用于查看原型。

## 2026-06-11 14:09 CST

- 完成：按“极简设计”反馈继续收口前台和后台原型，删除后台状态条、环境标签、说明型模块和菜单页附加描述；用户登录、用户注册、管理员登录继续保持独立页面。
- 验证：`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm style:l1 && pnpm build` 通过；`style:l1` 覆盖 10 个浏览器场景并重新生成原型截图。
- 下一步：基于当前极简版截图继续做少量删减或视觉微调。
- 阻塞/风险：当前预览仍使用 dev mock RPC，不代表真实生产数据。

## 2026-06-11 15:34 CST

- 完成：在保持极简文案和前后台分离的前提下优化布局比例。前台首页改为桌面双栏节奏，登录/注册/管理员登录卡片调整宽度、位置和控件间距；后台菜单入口增加清晰图标与箭头，账号表收窄日期和列宽，移动端 RBAC 隐藏非核心列并调整侧栏触发按钮。
- 验证：`cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test && pnpm style:l1 && pnpm build` 通过；已查看桌面首页、用户登录、后台菜单、账号表和移动端 RBAC 截图。
- 下一步：用户可基于新截图继续指定哪个页面还要更紧凑或更精致。
- 阻塞/风险：当前仍是 dev mock 原型，未接真实业务数据；本轮未提交推送。

## 2026-06-15 17:40 CST

- 完成：先在模板项目验证“JSON-RPC 从 data 层迁出”。已将 JSON-RPC 协议分发、权限检查和结果映射从 `server/internal/data/jsonrpc.go` 迁到 `server/internal/service/jsonrpc_dispatch.go`；`JsonrpcService` 直接持有 service 层 dispatcher，不再通过旧 `biz.JsonrpcUsecase -> data.JsonrpcData` pass-through。`data` 层只保留 repo / DB 访问，新增 `rbacRepo` 承担 RBAC overview 查询；`biz/rbac.go` 在保留原权限码真源的基础上新增最小 `RBACUsecase`。同步更新 Wire、service/data README 和 `scripts/init-project.sh` 扫描路径。
- 验证：`cd /Users/simon/projects/webapp-template/server && go generate ./cmd/server` 通过；`cd /Users/simon/projects/webapp-template/server && go test ./...` 通过；`cd /Users/simon/projects/webapp-template && bash scripts/init-project.sh --template-source --strict` 通过；`cd /Users/simon/projects/webapp-template && bash scripts/qa/fast.sh` 通过。
- 下一步：用户先查看模板项目效果；若确认这条分层迁移方式合适，再评估是否按同样分层口径迁移 `plush-toy-erp`，但 ERP 需要单独拆任务和扩大 JSON-RPC/RBAC 回归范围。
- 阻塞/风险：本轮未提交推送；工作区存在非本轮既有改动（如部署脚本、Dockerfile、Vite 配置等），本轮只隔离修改 JSON-RPC 分层相关路径。`bash scripts/qa/fast.sh` 会执行前端 `eslint --fix`，本次未发现新增前端文件进入本轮 diff。

## 2026-06-15 18:05 CST

- 完成：补齐 JSON-RPC dispatcher 分层链路文档。`server/internal/service/README.md` 明确 `/rpc/{url} -> JsonrpcService -> jsonrpcDispatcher -> biz usecase -> data repo`，并说明 dispatcher 只做协议分发、登录态 / 权限检查和结果映射；`server/internal/data/README.md` 明确不要新增 `data/jsonrpc*.go` 作为协议入口；`server/README.md` 增加后端分层总览链路。
- 验证：`git diff --check -- server/README.md server/internal/service/README.md server/internal/data/README.md progress.md` 通过。
- 下一步：若后续迁移 `plush-toy-erp`，沿用这条文档口径先写清链路，再迁移代码与测试。
- 阻塞/风险：本轮仅补正式文档，不改运行时代码、不提交推送。

## 2026-06-17 13:13 CST

- 完成：补充模板 JSON-RPC dispatcher 拆分触发线。当前模板仍保持 `system / auth / user / rbac` 通用域集中在 `jsonrpc_dispatch.go`，不按业务 ERP 项目提前拆成多文件；只有新增真实业务域、dispatcher 超过约 1000 行、单域超过约 250-300 行、职责互相穿插或 helper 重复明显时再拆。
- 完成：触发线写入 `server/internal/service/README.md`，继续保持 `service -> biz -> data` 边界，不恢复 `data/jsonrpc*.go` 协议入口。
- 验证：`git diff --check -- server/internal/service/README.md progress.md` 通过。
- 下一步：后续派生项目新增真实业务 RPC 域时，先按触发线判断是继续单文件维护，还是拆为 `jsonrpc_dispatch_<domain>.go` / helper 文件。
- 阻塞/风险：本轮只改模板文档和过程记录，不改运行时代码；当前工作区已有部署 / Dockerfile / Vite 等非本轮未提交改动，本轮未回退或纳入这些现场。

## 2026-06-20 Codex 项目 skills 补充

- 完成：新增 `.agents/skills/webapp-template-docs-governance/`、`.agents/skills/webapp-template-page-design-governance/`、`.agents/skills/webapp-template-code-review-governance/`，分别收口模板文档治理、页面设计治理和独立代码审查；项目 skill 均以仓库内 `.agents/skills/` 为 canonical。
- 完成：同步根 `README.md` 目录结构，登记 `.agents/skills/` 为 Codex 项目专属 skills 入口；本轮未更新 `docs/README.md`，因为没有新增、删除或重命名 `docs/` 文档，也未改变根级 docs 分层或推荐阅读顺序。
- 验证：追加前 `progress.md` 为 214 行、36639 字节，未达到归档阈值；已执行 `quick_validate.py`（通过临时 PyYAML 路径）验证 `code-review-governance` 与三份 webapp-template 项目 skill 均通过；已执行 Ruby YAML 解析、TODO / 默认提示扫描、`git diff --check -- .agents/skills README.md progress.md`，通过。
- 下一步：维护模板文档、页面或代码 review 时优先使用对应项目 skill；基于模板初始化派生项目时仍以 `docs/project-init.md` 和 `docs/current-source-of-truth.md` 为真源。
- 阻塞/风险：本轮只新增 Codex skill 和入口说明，不改运行时代码、schema、migration、RBAC、部署主路径、前端页面实现或质量脚本行为。

## 2026-06-20 Codex skill UI 名称英文化

- 完成：将 `.agents/skills/webapp-template-docs-governance/agents/openai.yaml`、`.agents/skills/webapp-template-page-design-governance/agents/openai.yaml`、`.agents/skills/webapp-template-code-review-governance/agents/openai.yaml` 的 `display_name` 改为英文，分别为 `Webapp Template Docs Governance`、`Webapp Template Page Design Governance`、`Webapp Template Code Review Governance`。
- 验证：追加前 `progress.md` 为 222 行、38016 字节，未达到归档阈值；已扫描相关 skills 的 `display_name`，确认无中文命中；后续以 skill 正文保持中英结合，UI chip 名称保持英文。
- 下一步：如 Codex UI 仍显示旧名称，重新打开会话或等待 skill metadata 刷新。
- 阻塞/风险：本轮只改 skill UI metadata，不改 `SKILL.md` 规则正文、运行时代码、schema、RBAC、部署主路径、前端页面或质量脚本。

## 2026-06-21 Codex 测试治理 skill 补充

- 完成：新增 `.agents/skills/webapp-template-test-governance/`，作为 webapp-template 项目专属测试治理入口，覆盖模板初始化、server、web、migration、health/ready、deploy preflight、style:l1、smoke/full/strict 和 loadtest 边界；同步根 `README.md` 中 `.agents/skills/` 职责为文档治理、页面治理、代码审查和测试治理。
- 完成：同步新增通用 `~/.codex/skills/test-governance/`，用于跨项目测试分类和验证范围选择；项目内仍以 `.agents/skills/webapp-template-test-governance/` 承载模板专属命令与边界。
- 验证：追加前 `progress.md` 为 229 行、38964 字节，未达到归档阈值；已执行 `quick_validate.py` 验证通用 `test-governance` 与项目 `webapp-template-test-governance` 均通过；已执行 Ruby YAML 解析、TODO 扫描、中文 `display_name` 扫描、默认提示扫描和 `git diff --check`，均通过。
- 下一步：后续涉及测试选择、模板初始化验证、页面回归、migration/deploy 或 loadtest 边界时优先使用 `$webapp-template-test-governance`；只需要通用测试分类时可用 `$test-governance`。
- 阻塞/风险：本轮只新增 Codex skill、README 入口和过程记录，不改运行时代码、schema、migration、RBAC、部署主路径、前端页面或真实测试脚本；因此未运行 server/web/full/strict、`style:l1`、loadtest 或远端部署验证。

## 2026-06-21 Codex 提示词治理 skill 补充

- 完成：新增 `.agents/skills/webapp-template-prompt-governance/`，作为 webapp-template 项目专属提示词治理入口，覆盖模板初始化、通用性、server/web/migration/deploy/loadtest、health/ready、提交推送和交接提示词；同步根 `README.md` 中 `.agents/skills/` 职责为文档治理、页面治理、代码审查、测试治理和提示词治理。
- 完成：通用 `~/.codex/skills/prompt-governance/` 已存在，用于跨项目提示词治理；项目内仍以 `.agents/skills/webapp-template-prompt-governance/` 承载模板专属边界。
- 验证：追加前 `progress.md` 为 237 行、40445 字节，未达到归档阈值；已执行项目 `webapp-template-prompt-governance` 和通用 `prompt-governance` 的 `quick_validate.py`、Ruby YAML 解析、TODO 扫描、中文 `display_name` 扫描、默认提示扫描和 `git diff --check`，均通过。
- 下一步：后续新开主会话、side chat、review 会话或需要把 webapp-template 需求整理成可执行任务时，优先使用 `$webapp-template-prompt-governance`；跨项目通用提示词整理使用 `$prompt-governance`。
- 阻塞/风险：本轮只新增 Codex skill、README 入口和过程记录，不改运行时代码、schema、migration、RBAC、部署主路径、前端页面、真实测试脚本或远端部署；因此不运行 server/web/full/strict、`style:l1`、loadtest 或远端部署验证。
