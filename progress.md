## 归档索引

- 2026-03 及更早历史流水：`docs/archive/progress-2026-03.md`。
- 2026-04 到 2026-05-03 早前流水快照：`docs/archive/progress-2026-04-to-2026-05-03-pre-admin-preset.md`。
- 当前文件只保留近期活跃事项和后续新增记录；归档文件只作追溯线索，不作为当前正式真源。

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
