## 2026-04-06 20:29
- 完成：把前一条只落在宿主机 live 的公网网关修复，继续回收到仓库真源。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile`，收口当前 `*.saurick.space` 公网 `Caddy` 反代模板，并把 GitLab 专用 `gitlab_proxy` 与 `header_down Set-Cookie "$" "; Domain=.saurick.space"` 正式写入仓库；同时新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PUBLIC_GATEWAY.md`，明确 live 配置路径、覆盖宿主机的更新命令、最小回归方法以及“整页 GitLab 继续直连、Portal fetch 继续同源代理”的稳定口径。`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 也已同步把这两份新真源挂入目录索引，避免后续机器迁移或宿主机重装时只能回翻聊天记录恢复。
- 验证：`/opt/homebrew/bin/caddy validate --config /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile --adapter caddyfile` 通过；仓库内 `ACCESS.md / README.md / PUBLIC_GATEWAY.md / lab-public-caddy.Caddyfile / progress.md` 已完成同轮收口。
- 下一步：如需把这条公网入口完全纳入自动化发布，可再补一个宿主机侧同步脚本，负责从仓库模板覆写 `~/.config/lab-public/Caddyfile` 并执行 `launchctl kickstart -k system/com.simon.lab-saurick.caddy`。
- 阻塞/风险：当前仓库已经有可重建模板和 runbook，但宿主机公网网关仍然不是由仓库脚本自动托管；如果后续有人只改了宿主机 live 文件却没回收仓库，仍会产生 drift，因此当前文档里保留了“先回收仓库，再同步宿主机”的口径。

## 2026-04-06 20:22
- 完成：继续把“公网 GitLab 已登录，但 Portal 仍提示先登录”收口到根因层，而不再只是换页面链接止血。直接更新宿主机公网网关配置 `/Users/simon/.config/lab-public/Caddyfile`，为 `gitlab.saurick.space` 单独引入 `gitlab_proxy`，在反向代理响应头上统一补写 `Set-Cookie ...; Domain=.saurick.space`，随后通过 `sudo launchctl kickstart -k system/com.simon.lab-saurick.caddy` 重启 root `LaunchDaemon` 生效。这样 GitLab 在公网域名下签发的 `_gitlab_session` 不再局限于 `gitlab.saurick.space`，而是同一浏览器里的 `portal.saurick.space` 也能带上并转发给 Portal 内置 `/gitlab`、`/gitlab-api` 代理。
- 完成：同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`，把这条公网 GitLab cookie 域共享口径写进正式访问文档，避免后续再把“Portal 复用 GitLab 登录态”误当成前端页面级偶然行为。
- 验证：`/opt/homebrew/bin/caddy validate --config /Users/simon/.config/lab-public/Caddyfile --adapter caddyfile` 通过；`launchctl print system/com.simon.lab-saurick.caddy` 已确认重启后 PID 切到新进程。`curl --noproxy '*' -I https://gitlab.saurick.space/users/sign_in` 现在明确返回 `set-cookie: _gitlab_session=...; Domain=.saurick.space`；随后用真实 GitLab 登录流拿到 `.saurick.space` cookie jar，再请求 `https://portal.saurick.space/gitlab-api/projects/1/jobs?...`，返回已从之前的 `204 + x-portal-login-required: 1` 变为 `200`。Playwright 再次走浏览器态验证：先在 `https://gitlab.saurick.space/users/sign_in` 登录成功进入 `Home · GitLab`，再回 `https://portal.saurick.space/?v=portal-gitlab-cookie-domain-e2e`，`Latest Load Test` 已从 `Login GitLab` 恢复成最近结果卡片，显示 `Passed / 03/22, 12:41 / Open pipeline / Open report`。
- 下一步：如果后续希望把这条能力变成“仓库真源可重建”而不是继续只存在于宿主机本地配置，可再把 `/Users/simon/.config/lab-public/Caddyfile` 的受管版本或生成脚本纳入仓库，例如在 `server/deploy/lab-ha` 下补一份公共网关模板与 reload runbook。
- 阻塞/风险：本轮已经真正解决了公网 GitLab 与 Portal 间的跨子域登录态复用，但只覆盖了经 `gitlab.saurick.space` 发出的 cookie；`portal.saurick.space/gitlab/users/sign_in` 这条同源登录页本身仍然不是可用整页入口，因为 GitLab 资源和表单依旧使用根路径。当前稳定口径仍然是“整页 GitLab 继续走 `gitlab.saurick.space`，Portal 数据 fetch 走同源代理”。

## 2026-04-06 19:52
- 完成：把上一版 live 里仍残留的坏登录入口修正到最终口径，并已发布到 `lab-platform` revision `27`。继续更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`：将首页 `Latest Load Test` 卡片里的 `GITLAB_LOGIN_URL` 从 `/gitlab/users/sign_in` 改回 GitLab 直连登录页；同时把 `loadtest-report.html` 的静态 `login-link` 恢复为直连地址，并在脚本里按当前 host 区分内外网，在 `*.saurick.space` 下自动改写成 `https://gitlab.saurick.space/users/sign_in`，避免再把用户带到 `portal.saurick.space/gitlab/users/sign_in` 这个会因 GitLab 资源与表单仍使用根路径而卡在 `Loading` 的伪可用页面。
- 验证：`SKIP_REPO_UPDATE=1 ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template`、`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 通过；`HELM_FORCE_CONFLICTS=1 SKIP_REPO_UPDATE=1 ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply` 已成功升级到 revision `27`，`lab-portal` rollout 完成。Playwright 公网回归确认：`https://portal.saurick.space/?v=portal-gitlab-login-fix-verify` 的 `Latest Load Test -> Login GitLab` 已指向 `https://gitlab.saurick.space/users/sign_in`；`https://portal.saurick.space/loadtest-report.html?job_id=999999999&v=portal-gitlab-login-fix-verify` 的报告页也会显示 `登录 GitLab -> https://gitlab.saurick.space/users/sign_in`，而不是坏掉的 `/gitlab/users/sign_in`。同时 `curl` 回读 live HTML 已确认报告页内联脚本包含基于 `isPublicPortalHost` 的登录链接改写逻辑。
- 下一步：如果后续要真正实现“先在 `gitlab.saurick.space` 登录一次，Portal 就自动复用这份登录态”，需要在 GitLab / 公网反向代理层统一 cookie `Domain=.saurick.space`，或者重构 Portal 的 GitLab 代理鉴权方案；单靠页面链接改写只能避免坏入口，不能消除跨子域 cookie 隔离。
- 阻塞/风险：当前公网体验已经修到“登录入口可用、整页 GitLab 不空白、Portal fetch 仍能复用同源代理登录态”，但跨子域自动共享 session 这件事还没真正解决。此前已验证 `portal.saurick.space/gitlab/users/sign_in` 虽返回 `200`，但 GitLab 登录页资源和表单仍指向根路径，导致浏览器控制台报脚本解析错误并卡在 `Loading`；要继续推进，必须改代理/上游，而不是再把 Portal 按钮指回这个地址。

## 2026-04-06 19:43
- 完成：把 `portal.saurick.space` 的 GitLab 入口进一步收口成“同源登录 / fetch，直连整页浏览”的最终口径。继续更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`：保留 `GITLAB_LOGIN_URL=/gitlab/users/sign_in`、`/gitlab-api/*`、`/gitlab/*` fetch 路径与 `loadtest-report.html` 同源，确保 Portal 读取最近压测结果和报告预览能复用 `portal.saurick.space` 下的 GitLab 登录态；但把首页 GitLab 主卡片、`Run Load Test` 卡片的 fallback href、`Latest Load Test` 初始 `Open pipelines / Run load test`、`CI Pipeline` 快照以及 docs / runbook blob 链接重新收回 `http://192.168.0.108:8929` 这条直连地址，由访问模式重写到 `gitlab.saurick.space`，避免未登录浏览器直接打开整页 GitLab 时被 Portal 的 `204 + x-portal-login-required` sentinel 截成空白页。
- 验证：`HELM_FORCE_CONFLICTS=1 SKIP_REPO_UPDATE=1 ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply` 已成功把 `lab-platform` 升到 revision `26`，`deployment/lab-portal` rollout 完成。Playwright CLI 重新打开 `https://portal.saurick.space/?v=portal-gitlab-samehost-verify` 后确认：首页 `Run Load Test` / `Load Test Guide` / `GitLab` / `CI Pipeline` / docs 列表在公网模式下都回到了 `https://gitlab.saurick.space/...` 整页链接，而 `Latest Load Test` 卡片在未登录态仍显示 `Login GitLab -> /gitlab/users/sign_in`。同时 `curl --noproxy '*' -I https://portal.saurick.space/gitlab/root/webapp-template-lab/-/blob/.../LOAD_TEST.md` 已明确证明：若把普通文档页也改成 `/gitlab/...`，未登录时当前 live `nginx` 会返回 `204 + x-portal-login-required: 1`，因此本轮回退是基于真实回归结论，而不是主观偏好。
- 下一步：如果后续真的想把 GitLab 整页浏览也统一收进 `portal.saurick.space/gitlab/...`，必须先改 Portal 内置 `nginx` 的登录 sentinel 设计，只让带显式 fetch 标记的请求走 `204 sentinel`，而不是继续对所有 `/gitlab/` 直接导航统一拦截；否则文档页、项目页、流水线页都会在未登录时继续落成空白页。
- 阻塞/风险：`monitoring/alert-webhook-receiver` 这次随 `lab-platform` 一起触发 rollout 后当前仍是 `0/1 Available`，属于同一 release 里的既有部署健康问题，不是 Portal GitLab 链接这轮新增造成的功能回归；但它会让 apply 脚本的等待输出长期停住，需要单独排查 `monitoring` 命名空间里的 Pod 事件/日志。本轮已经把 Portal live 页面恢复到“不空白、可登录、可读最近压测结果”的稳定状态。

## 2026-04-06 19:27
- 完成：继续收口 `portal.saurick.space` 引入 GitLab 子域名后的登录态分裂问题。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，把所有与 Portal 联动的 loadtest / pipeline / report / GitLab 登录主路径，从写死的 `http://192.168.0.108:8929` 与 `http://192.168.0.108:30088` 绝对链接，改成当前 Portal host 下的同源相对路径（如 `/gitlab/...`、`/loadtest-report.html?...`）。同时把首页 `Run Load Test` 卡片、`Latest Load Test` 初始按钮、`CI Pipeline` 快照入口，以及 GitLab 主卡片一并改成同源入口，避免公网 `portal.saurick.space` 与 `gitlab.saurick.space` 因 cookie 分属不同 host 而继续互相看不到登录态。
- 验证：`curl --noproxy '*' -k -I https://portal.saurick.space/gitlab/users/sign_in` 已确认同源代理返回 `200`，且会在 `portal.saurick.space` 下发 `_gitlab_session`；`curl --noproxy '*' -k -I https://portal.saurick.space/gitlab/root/webapp-template-lab/-/pipelines` 在未登录时返回预期的 `204 + x-portal-login-required: 1`。本地两份 Portal 真源都已通过 `ruby -e 'require "yaml"; YAML.load_file(...)'` 语法校验；`SKIP_REPO_UPDATE=1 ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 退出码为 `0`，说明这轮改动没有把 `lab-platform` 模板渲染链路打坏。
- 下一步：若要把“公网双域名”体验继续收口到更一致，可再评估是否将 Portal 内所有 GitLab blob 文档入口也切到 `/gitlab/...` 同源代理，避免用户在公网下先从文档页登录 GitLab，却误以为 Portal 已自动复用到同一份登录态。
- 阻塞/风险：本轮只修 Portal 与 GitLab 登录态复用最相关的功能入口，未改动那些纯文档/只读 runbook blob 链接；这些链接在公网下继续按访问模式打开 `gitlab.saurick.space` 本身，不会影响 Portal 读压测结果，但若用户恰好先在这类直连页登录，Portal 仍不会自动继承那份跨子域 cookie。本轮尚未 live apply 到 `lab-portal` Deployment，因此实际页面仍需在发布后才能生效。

## 2026-04-06 17:02
- 完成：为 `lab-ha` 的 `Cilium Gateway` 下线提交补齐 `yamllint` 真源兼容。将 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/templates/httproutes.yaml` 的 `# yamllint disable-file` 挪到文件首行，避免 `yamllint` 先把 Helm 模板起始 `{{- if ... }}` 当成裸 YAML 语法报错；同时把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/gateway-api-v1.4.1-standard-install.yaml` 纳入根 `/Users/simon/projects/webapp-template/.yamllint` 忽略列表，明确这份上游 vendored Gateway API CRD 不参与仓库增量风格 lint，避免为一次性镜像文件引入大规模无收益重排。
- 验证：待执行 `bash /Users/simon/projects/webapp-template/scripts/qa/yamllint.sh`、`git commit`、`git push origin master`、`git push gitlab master`。
- 下一步：若 `yamllint` 通过，直接提交 `lab-ha 下线 ingress-nginx 并收口 Gateway 真源`，随后依次推送到 `origin`、`gitlab`。
- 阻塞/风险：当前阻塞只剩提交前质量门禁；live 集群仍未安装 `Gateway API CRD`，因此本轮仍然只是仓库真源切换，不代表现场已经切流。

## 2026-04-06 16:24
- 完成：正式把 `lab-ha` 的业务入口从 `ingress-nginx` 下线并收口到 `Cilium Gateway API`。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，移除 `ingress-nginx` 仓库与 release、删除 `platform-ingresses.yaml` 同步入口，并保持 `Cilium 1.19.2 + Gateway API CRD` 作为唯一入口控制器真源；同步删除 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/ingress-nginx-values.yaml`、`charts/webapp-template/templates/ingress.yaml`、`scripts/ensure-ingress-nodeport-cluster.sh`、`scripts/check-webapp-cilium-gateway-shadow.sh`、`scripts/check-webapp-prod-trial-internal.sh`、`charts/webapp-template/values-prod-trial-internal.yaml`、`manifests/argocd-webapp-prod-trial-app-internal.yaml` 及对应 `argocd/webapp-prod-trial-internal/` 旧 overlay，避免仓库里继续保留已退役入口路径。
- 完成：把业务正式端口切到 `Gateway hostNetwork`。`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-lab.yaml` 现改为 `32668` listener；`values-prod-trial.yaml` 改为 active `30089`、preview `30091` listener，并把 `rollout analysis` 从旧 `Host` 头探测收口为直接打正式端口。与此同时，`NetworkPolicy` 去掉了对 `ingress-nginx` namespace 的硬编码，只保留节点侧探针来源，入口放行统一交给新增的 `CiliumNetworkPolicy`。
- 完成：同步清理平台代理、黑盒探测、治理看板和历史清单。`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 不再代理 `30089/30091`；`blackbox-values.yaml`、`prometheus-rule-service-governance.yaml`、`grafana-lab-service-governance-dashboard.yaml` 全部改成直接看 `32668 / 30089 / 30091` 的 blackbox probe；`alert-webhook-receiver.yaml` 去掉了旧 `Ingress`；`manifests/webapp-template-lab.yaml`、`argocd/webapp/webapp-template-lab.yaml`、`argocd/webapp-prod-trial/webapp-template.yaml` 里的历史 `Ingress` 片段也已删除，避免旧 Kustomize 副本继续误导。
- 完成：同步更新正式文档和 runbook。`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`ACCESS.md`、`PROD_TRIAL.md`、`INTERNAL_DNS.md`、`OPS_CHECKLIST.md`、`BEST_PRACTICES.md`、`HANDOVER.md`、`TAILSCALE.md`、`TROUBLESHOOTING.md`、`CILIUM_HUBBLE_RUNBOOK.md`、`CILIUM_GATEWAY_MIGRATION.md` 已统一改成“`Cilium Gateway` 正式入口”口径；`ha-lab-runbook.md` 与 `ha-lab-plan-v2.md` 顶部也补了历史说明，明确其中 `ingress-nginx` 内容只作演进背景，不再代表 live 方案。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-tracing.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 通过；`helm template headlamp .../charts/headlamp -f .../manifests/headlamp-values.yaml`、`helm template webapp-template-lab .../charts/webapp-template -f .../values-lab.yaml`、`helm template webapp-template-prod-trial .../charts/webapp-template -f .../values-prod-trial.yaml`、`helm template cilium cilium/cilium --version 1.19.2 -f .../cilium-values.yaml` 通过；`/bin/bash .../scripts/helm-release.sh template` 已同步更新 `charts/lab-platform/files/raw/*`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 通过。`Gateway/HTTPRoute` 两套 chart 的 `server dry-run` 当前仍因 live 集群尚未安装 `Gateway API CRD` 而报 `no matches for kind "Gateway"/"HTTPRoute"`，这与本轮“只改仓库真源、未改 live 集群”一致。
- 下一步：真正切 live 时，先 `kubectl apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/gateway-api-v1.4.1-standard-install.yaml`，再 `ONLY=cilium bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply`，随后让 Argo 同步 `webapp lab / prod-trial`，最后执行 `check-webapp-prod-trial-bluegreen.sh` 与 `check-ha-lab-cold-start.sh` 做正式回归。
- 阻塞/风险：这轮还没有对 live 集群执行 `Gateway API CRD` apply、`cilium` 升级或业务切流，因此仓库虽然已经不再保留旧入口真源，现场仍需按上面的顺序完成集群切换；另外工作区里仍存在本轮无关的未提交改动（例如 `/Users/simon/projects/webapp-template/server/deploy/README.md`、`get-headlamp-token.sh` 等），本轮未回退这些用户修改。

## 2026-04-06 13:59
- 完成：为 `lab-ha` 落地 `Cilium Gateway API` 第一阶段真源，但先保持并行验证而不切主入口。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/gateway-api-v1.4.1-standard-install.yaml`，并更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`：`template/list/apply` 现在会把这份 `Gateway API CRD` 一并纳入流程，且 `cilium` release 已从 `1.17.6` 升到 `1.19.2`。同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/cilium-values.yaml`，正式打开 `gatewayAPI.enabled`、`gatewayAPI.hostNetwork.enabled`、`prometheus.serviceMonitor`、`operator.prometheus.serviceMonitor`、`envoy.prometheus.serviceMonitor`，并按 `1.19.2` schema 收口 `gatewayClass.create=\"true\"` 与 `trustCRDsExist=true`，避免模板阶段就因 CRD 校验报错。
- 完成：为 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/` 增加并行 `Gateway / HTTPRoute / CiliumNetworkPolicy` 能力，保留现有 `Ingress` 不动。新增模板 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/templates/gateway.yaml`、`httproutes.yaml`、`cilium-ingress-policy.yaml`，并在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values.yaml` 扩展 `gateway/httpRoutes/ciliumIngressPolicy` 配置。`lab` values 新增 `38080` shadow listener，`prod-trial` values 新增 `38089/38091` active/preview shadow listener；两套 values 都补了只放行 `reserved:ingress` 到 `8000/TCP` 的 Cilium 入口策略。这样第一阶段先验证 `Cilium Gateway` 链路，不和现有 `ingress-nginx` 的 `32668/30089/30091` NodePort 抢端口。
- 完成：补齐验证脚本与文档口径。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-cilium-gateway-shadow.sh`，用于按三台节点校验 `38080 / 38089 / 38091` 的 shadow `/readyz`；新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/CILIUM_GATEWAY_MIGRATION.md` 说明迁移阶段、应用顺序、验收口径与第二阶段计划；并同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`ACCESS.md`、`PROD_TRIAL.md`，把 `Cilium Gateway shadow` 明确标成“并行验证，不是正式推荐入口”。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-cilium-gateway-shadow.sh` 通过；`kubectl apply --dry-run=client -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/gateway-api-v1.4.1-standard-install.yaml` 通过；`helm template cilium cilium/cilium --version 1.19.2 --namespace kube-system -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/cilium-values.yaml >/dev/null` 通过；`SKIP_REPO_UPDATE=1 ONLY=cilium bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 通过并生成 `artifacts/helm-rendered/gateway-api-crds.yaml` 与 `cilium.yaml`；`helm template` 已分别验证 `values-lab.yaml`、`values-prod-trial.yaml`、`values-prod-trial.yaml + values-prod-trial-internal.yaml` 均能同时渲染旧 `Ingress` 与新 `Gateway/HTTPRoute/CiliumNetworkPolicy`。
- 下一步：把这批真源推到 live 之前，先按 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/CILIUM_GATEWAY_MIGRATION.md` 执行一次最小变更链路：1) apply `Gateway API CRD`；2) `ONLY=cilium` apply；3) 让 Argo 同步 `webapp lab / prod-trial`；4) 运行 `check-webapp-cilium-gateway-shadow.sh` 与 Hubble/Grafana 联合验收。shadow 入口稳定后，再做第二阶段：迁业务正式端口、迁治理指标与告警、最终下线 `ingress-nginx`。
- 阻塞/风险：这轮只完成了真源与本地渲染校验，还没有对 live 集群执行 `cilium` 升级或 `Gateway` 验证；当前 `Service Governance` 看板和告警仍然绑定 `nginx_ingress_controller_*`，因此 shadow 入口还不能替代正式值班口径；另外当前工作区本身仍存在多处与本轮无关的未提交改动（例如 `platform-portal.yaml`、`BEST_PRACTICES.md`、`TAILSCALE.md` 等），本轮没有回退或整理它们。

## 2026-04-06 10:56
- 完成：把 `lab-portal` 正式收口成“内网 / 外网双入口”模式，并将同一份真源同步到 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`。Portal 右上角新增全局访问模式切换按钮，支持在 `IP:Port` 与公网 `HTTPS` 域名之间切换，默认按当前 host 推断内外网模式并记住浏览器上次选择；页面内主卡片、快照区动作链接、文档链接和压测报告入口都已统一跟随当前访问模式切换。与此同时，`hero/pill/notes` 文案已从“只推荐 IP:Port”更新为“双入口并存”的正式口径，`loadtest-report.html` 也已改为优先复用 Portal 同源代理而不是写死 GitLab 内网地址。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`，把实验室访问口径改成“内网 `IP:Port` + 公网 `*.saurick.space` 双入口”，并补齐 `Portal / WebApp Lab / WebApp Prod-Trial Active / Preview / Harbor / Grafana / Headlamp / Jaeger / Prometheus / Alertmanager / Argo CD / Longhorn / Hubble / SeaweedFS Filer / Alert Sink / GitLab / SeaweedFS S3` 的公网域名列表，同时注明 Portal 会按 host 默认选择内外网模式。
- 完成：宿主机公网入口改为多子域名反代。更新 `/Users/simon/.config/lab-public/Caddyfile`，通过一台 `Caddy` 在 IPv6 `80/443` 上对 `app / portal / harbor / grafana / headlamp / jaeger / prometheus / alertmanager / argocd / longhorn / hubble / seaweedfs / alertsink / gitlab / preview / s3 / lab.saurick.space` 提供统一 `HTTPS`，其中 `app.saurick.space` 继续带 `Host: app.192.168.0.108.nip.io` 反代到共享 ingress，`argocd.saurick.space` 通过外层 `Caddy` 终止浏览器证书、内层继续反代到原始自签 `30443`。Cloudflare DNS 侧已把这些子域名统一收口成 `CNAME -> lab.saurick.space`，继续复用原有 `lab.saurick.space` 的动态 IPv6 DDNS，不再为每个子域名单独跑 DDNS。
- 完成：live 发布 Portal 改动。`helm template lab-platform ...` 已确认新 Portal 内容进入渲染结果；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f - < /tmp/lab-platform-rendered.yaml` 通过。首次 `ONLY=lab-platform ... helm-release.sh apply` 命中 `lab-portal-site` ConfigMap 与历史 `kubectl-client-side-apply` field manager 冲突，随后按脚本预留口径只对 `lab-platform` 单次开启 `HELM_FORCE_CONFLICTS=1` 重新 apply，成功升级到 `lab-platform` revision `21`，并完成 `alert-webhook-receiver` rollout。
- 验证：公网证书已全部签发成功，`portal.saurick.space`、`app.saurick.space`、`grafana.saurick.space`、`argocd.saurick.space`、`gitlab.saurick.space` 等域名当前证书均为 Let’s Encrypt；`curl --noproxy '*' -k -L -s -o /dev/null -w 'code=%{http_code}' https://<host>/` 已确认 `portal/app/harbor/grafana/headlamp/jaeger/prometheus/alertmanager/argocd/longhorn/hubble/seaweedfs/alertsink/gitlab/preview/lab` 返回 `200`，`s3.saurick.space` 返回预期的 `403 AccessDenied`。`curl --noproxy '*' -fsSL http://192.168.0.108:30088/ | rg 'labPortalAccessMode|portal.saurick.space|公网 HTTPS'` 已确认 live Portal 是新版本；Playwright CLI 已实际打开 `https://portal.saurick.space/`，确认公网域名下默认选中 `Public`，所有卡片 href 都切到 `https://*.saurick.space`；随后再次点击 `Internal`，确认同一张页面上的卡片和快照链接统一切回 `http://192.168.0.108:port`。另外又实际打开 `https://lab.saurick.space/` 与 `https://app.saurick.space/`，两者真实浏览器标题都已渲染为 `Project Workspace`，不是空白壳页。
- 下一步：如果后续还想进一步收口体验，最值的是两项：一是为 `portal.saurick.space` 的 GitLab 摘要读取补一层免噪处理，避免未登录 GitLab 时浏览器控制台一直保留 `401`；二是评估是否给这批公网管理面再加最薄的一层 basic auth / 单点登录，而不是长期完全裸露。
- 阻塞/风险：当前公网入口依赖这台宿主机在线且 IPv6 可达，Mac 休眠/断网会导致所有公网域名一起中断；Portal 浏览器回归里仍保留一条既有 `401` 控制台错误，来源是未登录 GitLab 时读取最近压测 job 摘要，不影响页面打开和访问模式切换；`SeaweedFS S3` 公网入口当前按预期返回 `403 AccessDenied`，它是 API 不是浏览器页面；另外工作区本身仍有若干与本轮无关的未提交改动（如 `server/deploy/README.md`、`BEST_PRACTICES.md` 等），本轮没有碰它们。

## 2026-04-06 11:33
- 完成：继续收口 `portal.saurick.space` 的未登录 GitLab 噪音。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，把 Portal 内置 `nginx` 对 `/gitlab-api/`、`/gitlab/` 的未登录代理返回从浏览器可见的 `401` 改成无内容的 `204 + X-Portal-Login-Required: 1` sentinel，同时前端 `fetchGitLabJson/fetchGitLabText/fetchGitLabHtml` 与 `loadtest-report.html` 一并改成识别这条 sentinel，继续展示“先登录 GitLab”状态，但不再制造控制台红错。由于这次改的是 `default.conf`，额外对 live `deployment/lab-portal` 执行了 `rollout restart`，确保运行中的 `nginx` 重载新配置。
- 验证：`helm template lab-platform ...` 已确认渲染结果包含 `GITLAB_LOGIN_REQUIRED_HEADER`、`error_page 301 302 307 308 401 = @gitlab_login_required` 与 `X-Portal-Login-Required "1"`；`ONLY=lab-platform SKIP_REPO_UPDATE=1 bash .../helm-release.sh apply` 首次仍命中历史 `kubectl-client-side-apply` 对 `lab-portal-site.data.default.conf` 的 field manager 冲突，随后按同一迁移口径仅对 `lab-platform` 单次开启 `HELM_FORCE_CONFLICTS=1` 重新 apply，成功升级到 revision `23`。live 上 `curl --noproxy '*' -i -s 'https://portal.saurick.space/gitlab-api/projects/1/jobs?per_page=1'` 现返回 `HTTP/2 204` 与 `x-portal-login-required: 1`；Playwright CLI 重新打开 `https://portal.saurick.space/?v=gitlab-login-noise-check-2` 后读取浏览器控制台，当前 `Total messages: 0`，此前那条 GitLab `401` 噪音已消失。
- 下一步：如果还要继续优化这张 Portal 的外网体验，优先考虑给“最近压测结果”补一个更明确的未登录占位提示或手动刷新动作，而不是继续堆后台轮询。
- 阻塞/风险：这次只是把“未登录 GitLab”从浏览器红错降为静默 sentinel，不改变 GitLab 登录要求本身；Portal 读取最近压测摘要依旧依赖当前浏览器存在 GitLab 登录态。当前 `lab-platform` 里 `lab-portal-site` ConfigMap 的 field manager 漂移虽已再次靠 `HELM_FORCE_CONFLICTS=1` 收口，但这也说明这条资源历史上被多种路径改过，后续若再手工 `kubectl apply` 同一对象，仍可能反复制造 ownership 噪音。

## 2026-04-06
- 完成：把 `Headlamp` 的长期登录凭据正式收口进 `WebApp Lab Portal`，同时避免把明文 token 提交进 git。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，让 `lab-portal` 通过可选 Secret 挂载暴露同源只读入口 `/portal-secrets/headlamp-access.json`，并在默认账号区新增 `Headlamp 10y token` 卡片、复制按钮、签发/到期时间与 `Open Headlamp` 入口。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/sync-headlamp-portal-token.sh`，用于生成 `headlamp/headlamp-admin` 的 10 年 token 并同步到 `lab-portal/lab-portal-headlamp-access` runtime Secret；同时增强 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh`，支持 `TOKEN_DURATION=10y` 这类自然年时效。文档 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`README.md`、`OPS_CHECKLIST.md` 已同步改成“Portal 可直接复制 Headlamp 长时效 token、明文不进 git”的正式口径。
- 完成：修复 `Headlamp 10y token` 卡片点击后只显示“手动复制”但不给可复制入口的问题。Portal 复制逻辑现在改成三层兜底：先尝试 `navigator.clipboard.writeText(...)`，失败后退回 `document.execCommand('copy')`，再失败才弹出浏览器原生 prompt 供人工选中复制，不再只是改按钮文案。对应变更已 live 发布到 `lab-portal`。
- 完成：按最新交互要求移除 `Headlamp 10y token` 卡片里的 `Open Headlamp` 按钮，避免默认账号区同时出现“复制 token + 打开 Headlamp”两个动作。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与对应 `charts/lab-platform/files/raw/platform-portal.yaml`，同步清理无用样式、翻译键与 JS 状态字段，并已 live 发布到 `lab-portal`。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/sync-headlamp-portal-token.sh` 通过；Portal 内联脚本已抽出并通过 `node --check`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 通过。live 已完成 `kubectl apply`、`lab-portal` rollout、以及 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/sync-headlamp-portal-token.sh`；当前 `http://192.168.0.108:30088/portal-secrets/headlamp-access.json` 可直接返回 `headlamp/headlamp-admin`、`duration=10y`、`expiresAt=2036-04-05T16:52:38+00:00` 与对应 token。Playwright 已实际打开 `http://192.168.0.108:30088/?v=headlamp-token-check`，确认页面上出现 `Headlamp 10y token` 卡片、`Copy token` 按钮已可用、`Open Headlamp` 链接指向 `http://192.168.0.108:30087`，并显示 `Issued 04/06/2026, 00:52 · Expires 04/06/2036, 00:52`。
- 验证：补丁发布后，Playwright 再次实际点击 `Copy token` 按钮，页面已不再停留在“只有文案变化、没有复制入口”的旧状态；当前环境里若系统剪贴板仍不可用，会进入新的 prompt 手工复制兜底。
- 验证：移除按钮后，`curl --noproxy '*' -fsS 'http://192.168.0.108:30088/?v=headlamp-open-removed-2' | rg 'headlamp-token-open|Open Headlamp|打开 Headlamp'` 已无匹配；Playwright 重新打开同一地址后，`Headlamp 10y token` 卡片在快照里只剩 `Copy token` 单按钮。仓库级前端质量命令 `cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test` 也已通过。
- 下一步：如果后续要继续收紧管理面暴露，优先把这条长期 token 的轮换动作纳入值班/交接流程，例如按季度主动重跑同步脚本，或后续再补 OIDC/basic auth，而不是继续扩大长期 token 的传播面。
- 阻塞/风险：当前这条 token 是 `headlamp-admin` 绑定 `cluster-admin` 的长时效凭据，且 Portal 已通过同源静态入口暴露给能访问 `30088` 的用户；这符合当前“实验室内网直接值班”诉求，但安全边界明显弱于短期 token/OIDC。浏览器回归里仍保留一条既有 `401` 控制台错误，来源是未登录 GitLab 时 Portal 拉最近压测摘要的现有逻辑，不是本轮 Headlamp token 功能新增的问题。

## 2026-03-27
- 完成：继续完善 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/VM_POWER_SEQUENCE.md`，把“整套重新开机时的影响”也显式收口成独立章节与表格，明确 `1/3`、`2/3`、`3/3` 节点恢复时分别意味着“单机起来了 / 控制面开始恢复 / 整套接近恢复完成”，并补充 `192.168.0.108` 固定管理入口、`etcd quorum`、`Longhorn PVC` 收敛这几类最容易误判的现场现象。随后又把文档从平台绑定口径改成平台无关描述，删掉对特定虚拟化产品界面的依赖，并新增“值班速查”表，直接回答“先关谁、先开谁、看到什么算正常、什么时候不要继续点下一台”。
- 验证：本轮仅做文档增强，已人工回读新增“开机阶段的影响”章节；未执行新的 live 开机/关机或集群验收命令。
- 下一步：如果后续要继续压缩值班成本，可考虑再把这份速查表同步到 Portal 或值班首页，让顺序和验收条件不只存在于仓库文档里。
- 阻塞/风险：文档已经说明“2/3 节点恢复 ≠ 业务入口全部恢复”，但 live 中实际 `VIP` 持有者、`etcd leader`、PVC 收敛速度仍会随现场状态波动，值班时仍需结合 `check-ha-lab-cold-start.sh` 验证。

## 2026-03-27
- 完成：把“三台 VM 计划性关机 / 开机顺序与影响”正式收口成独立文档，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/VM_POWER_SEQUENCE.md`，明确当前 `lab-cp-01/02/03 -> 192.168.0.7 / 192.168.0.108 / 192.168.0.128` 的固定映射、`192.168.0.110` 只是 `API VIP` 而不是某台永久主机、单台维护与整套停机的影响边界、推荐关机顺序 / 开机顺序，以及每轮电源操作后的统一验收命令。同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/OPS_CHECKLIST.md`，把这份 runbook 挂到值班入口与恢复手册里，避免后续再靠聊天记录记忆顺序。
- 验证：本轮仅做文档收口，已人工回读新增文档与入口引用，确认 `README / RECOVERY_RUNBOOK / OPS_CHECKLIST` 都已指向 `VM_POWER_SEQUENCE.md`；未执行新的 live 关机 / 开机或集群验收命令。
- 下一步：如果后续要把当前 VM 显示名和这份文档完全对齐，可再补一份虚拟化管理平台侧的显示名改名记录，确保 `lab-cp-01/02/03` 与当前固定 IP 映射不会再靠人工口头记忆。
- 阻塞/风险：这份 runbook 已把当前推荐顺序和影响说清楚，但 `API VIP` 持有者与 `etcd leader` 本质上仍会漂移；因此文档里保留了“先查 live 角色、再决定顺序”的口径，不能把某台节点永久当成固定主节点。

## 2026-04-01
- 完成：把最近这轮 `lab-ha` 节点基线与电源操作口径正式收口到仓库真源。`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh` 现支持通过 `STATIC_IPV4 / DEFAULT_GATEWAY_IPV4 / DNS_IPV4S / NETWORK_IFACE` 可选参数把固定节点 IP 直接持久写入 `netplan`，避免入口节点重启后继续因 DHCP 漂移；`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ha-lab-runbook.md`、`README.md`、`TROUBLESHOOTING.md` 已同步补齐静态 IP 基线与 `192.168.0.108` 漂移恢复步骤。另新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/VM_POWER_SEQUENCE.md`，把三台 VM 的计划性关机 / 开机顺序、影响、值班速查、冷启动验收和平台无关的电源操作建议收成正式 runbook，并在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md`、`OPS_CHECKLIST.md`、`README.md` 挂上入口。
- 验证：已人工回读上述脚本与文档 diff，确认静态 IP 参数、`VM_POWER_SEQUENCE.md` 新文档、以及 `README / RECOVERY_RUNBOOK / OPS_CHECKLIST` 的入口引用一致；本轮未执行新的 live 集群变更或电源操作验证。
- 下一步：把这套“固定入口节点静态 IP + 计划性 VM 电源顺序 + 冷启动验收”继续沉到日常值班入口，必要时再把值班速查同步到 Portal，减少人工翻文档成本。
- 阻塞/风险：当前 runbook 已把推荐顺序和验收条件写清楚，但 `API VIP` 持有者、`etcd leader` 与 PVC 收敛速度仍属于 live 状态，实际维护时仍应先查当前角色，再结合 `check-ha-lab-cold-start.sh` 判断是否真正恢复完成。

## 2026-04-01 02:35
- 完成：排查“宿主机重启后 `192.168.0.108` 和 `192.168.0.128` 看起来服务角色互换”的现场，确认并不存在节点身份或固定 IP 互换。`kubectl get nodes -o wide`、三台节点 `netplan` 与 `CiliumNode` 回读都保持 `node1=192.168.0.7`、`node2=192.168.0.108`、`node3=192.168.0.128`。真正的根因是宿主机重启后先出现时间同步窗口，导致一批基于 projected service-account token 的组件短暂被 apiserver 拒绝为 `token is not valid yet`，随后 `Cilium / ingress / Longhorn / Harbor / 监控` 的恢复顺序被打乱，形成了“`108` 上入口失效、`128` 上部分服务先恢复”的错觉；另有 `node1` 的静态 `kube-apiserver` 镜像 Pod 因 containerd name reservation 残留为 `CreateContainerError`，使冷启动脚本一直误报未通过。
- 完成：live 侧按最小扰动顺序完成恢复。先删除并重建 `cilium` 与 `ingress-nginx` 的异常 Pod，恢复 `node2` 的数据面和 `192.168.0.108` 入口；随后清理受宿主机重启影响的陈旧控制器 / Stateful workload Pod，等待 `Longhorn` 相关卷重新 `attach + rebuild + healthy`，让 `Harbor / Grafana / Prometheus / Jaeger / SeaweedFS / WebApp` 回到正常收敛；最后在 `node1` 上仅重建静态 `kube-apiserver` 容器本身，清除保留的 container name 冲突，让镜像 Pod 状态重新与真实运行中的 apiserver 对齐。整个过程中没有更改仓库模板逻辑，也没有修改三台节点的固定 IP 映射。
- 验证：`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 已 live 通过，输出确认三节点基线正常、`nodes=all-ready`、`pods=no-critical-errors`；`kubectl get --raw='/readyz?verbose'` 返回 `readyz check passed`；`kubectl get pods -A` 当前已无 `CrashLoopBackOff / Pending / CreateContainerError / Init`；对外入口 `http://192.168.0.108:30088/`、`http://192.168.0.108:30081/login`、`http://192.168.0.108:32668/readyz`、`https://192.168.0.108:30443/`、`http://192.168.0.120/readyz` 均返回 `200`。补充以 `--noproxy '*'` 直接验证统一 Ingress VIP 后，`harbor/app/argocd` 入口经 `192.168.0.120` 访问也已恢复到 `200`，`grafana` 返回符合预期的 `302 -> /login`。
- 下一步：把“宿主机重启后先查时钟同步、Cilium、Longhorn、静态 apiserver 镜像 Pod 残影”的排障路径补进对应 runbook，避免下次把 `VIP / NodePort / ingress VIP` 的正常漂移误判成节点角色互换。
- 阻塞/风险：当前用户面与冷启动验收已经恢复通过；剩余现场尾巴是 `argocd/webapp-template-prod-trial` 仍处于 `OutOfSync + Healthy`，这是本轮恢复前就存在的配置漂移，不影响这次宿主机重启后的入口恢复，但后续仍建议单独收口，避免值班时把“GitOps 漂移”和“节点/入口故障”混在一起。

## 2026-03-27
- 完成：把 `node1` 与 `node3` 也从 DHCP 收口为静态 IP，避免三台 VM 里只有 `node2` 固定、其余节点仍在重启后碰运气拿 lease。live 侧已分别将 `192.168.0.7` 与 `192.168.0.128` 的 `/etc/netplan/50-cloud-init.yaml` 改为静态配置：`dhcp4/dhcp6=false`、固定地址分别为 `192.168.0.7/24` 与 `192.168.0.128/24`、默认网关统一 `192.168.0.1`、DNS 统一 `192.168.0.1`；`node2` 继续保持上一轮已修复的静态 `192.168.0.108/24`。这样当前三台控制面节点都不再依赖 DHCP，重启后地址不应再漂。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide` 已确认三台节点仍为 `Ready`，地址分别是 `192.168.0.7 / 192.168.0.108 / 192.168.0.128`；三台节点的 `ping + SSH` 正常，远端回读 `/etc/netplan/50-cloud-init.yaml` 已全部为静态配置；`kubectl get ciliumnodes.cilium.io` 已确认 `node1/node2/node3` 的 `InternalIP` 分别收口为 `7 / 108 / 128`；关键入口 `http://192.168.0.108:32668/readyz`、`http://192.168.0.108:30088/`、`http://192.168.0.108:30081/login`、`https://192.168.0.108:30443/` 当前返回 `200`。
- 下一步：如果要真正把“虚拟机名称”从 `node1/node2/node3` 改掉，建议先只改宿主机/虚拟化管理平台里的显示名，不要直接改来宾机 `hostname`；当前这三台是 `kubeadm` 控制面节点，若要连来宾机 hostname / Kubernetes node name 一起改，需要单独按“drain + 重建/重新加入控制面”的口径做，不适合顺手在线改。
- 阻塞/风险：这次只收口了“IP 重启不漂”问题，没有动 `kube-system` 里之前遗留的部分 `CreateContainerError` 记录；它们和本轮静态 IP 配置不是同一类问题，后续仍建议单独清理后再完整复跑一次 `check-ha-lab-cold-start.sh`。

## 2026-03-26
- 完成：排查并修复 `192.168.0.108` 在三台 VM 重启后不可访问的问题。根因已确认不是整机宕掉，而是 `node2` 重启后从 DHCP 漂到了 `192.168.0.107`，但 `Portal / GitLab / Harbor / Argo CD` 入口、`kubeadm` 静态 Pod 广告地址与 node2 本机配置仍都依赖 `192.168.0.108`。live 侧已把 node2 的 `/etc/netplan/50-cloud-init.yaml` 收口为静态 `192.168.0.108/24 -> 192.168.0.1`，随后重启 `containerd / kubelet`，并滚动 node2 上的 `cilium` DaemonSet，让 `CiliumNode/node2` 从旧地址 `192.168.0.107` 更新到 `192.168.0.108`，恢复外部对 `108` 的 NodePort 访问。仓库侧同步增强 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh`，新增可选 `STATIC_IPV4 / DEFAULT_GATEWAY_IPV4 / DNS_IPV4S / NETWORK_IFACE` 参数，允许初始化时直接把固定入口节点的静态 IP 持久写入 `netplan`；并更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ha-lab-runbook.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`，把“固定入口节点不能继续依赖 DHCP”的基线与恢复步骤收口为正式文档。
- 验证：`ping` 与 `nc -z` 已确认 `192.168.0.108` 的 `ICMP / SSH` 恢复；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide` 与 `kubectl get ciliumnodes.cilium.io node2 -o jsonpath='{.spec.addresses}'` 已确认 node2 与 `CiliumNode` 都回到 `192.168.0.108`；外部入口已实测 `http://192.168.0.108:32668/readyz`、`http://192.168.0.108:30088/`、`http://192.168.0.108:30081/login`、`http://192.168.0.108:30090/-/ready`、`https://192.168.0.108:30443/` 返回 `200`，`http://192.168.0.108:30093/` 与 `http://192.168.0.108:30086/` 的 `HEAD` 分别返回 `405 / 501`，说明服务已恢复但这些端点不接受 `HEAD`；`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh` 通过。
- 下一步：补做一次控制面静态 Pod 的专项收口，重点确认 `kube-system` 里残留的 `CreateContainerError` 不是新的运行时故障，而只是重启后的旧尝试对象未清理；随后再完整复跑 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`，把最近冷启动摘要刷回绿色。
- 阻塞/风险：当前 `check-ha-lab-cold-start.sh` 仍未全绿，主要因为 `kube-system` 里还残留 `etcd-node2`、`kube-apiserver-node2` 以及其他控制面静态 Pod 的 `CreateContainerError` 记录；虽然当前用户侧固定入口已经恢复，且关键页面都能直接打开，但在这些残留状态进一步清干净前，不建议把这次问题误判为“整套冷启动基线已经完全通过”。

## 2026-03-24
- 完成：继续收口 Harbor 入口时，直接抓取了 `POST /v2/.../blobs/uploads/` 的响应头，确认当前 `harbor-ui-proxy` 用 Nginx `$host` 转发会丢掉 `:30002` 端口，导致 registry upload 的 `Location` 被错误返回为 `http://192.168.0.108/...`，客户端随后错误地去连 `:80`。已把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/harbor-ui-proxy.yaml` 及其 chart raw 副本改为使用 `$http_host`，并补 `X-Forwarded-Host`，让 Harbor 在反向代理后仍能生成带端口的正确 upload URL。
- 下一步：把新的 `harbor-ui-proxy` 配置 apply 到 live，并再次验证 `POST /v2/.../blobs/uploads/` 的 `Location` 是否已带 `:30002`；通过后继续把 Headlamp 镜像推入 Harbor，再切 `headlamp-values.yaml`。
- 阻塞/风险：当前 API 链路仍会偶发 `EOF / context deadline exceeded`；但 Harbor 问题已经不是模糊 `502`，而是被明确收窄到“反向代理丢端口 + 上传链路不稳”两条具体点。

## 2026-03-24
- 完成：继续处理 `Headlamp` 与 `Harbor` 的 live 收口时，确认当前新的主阻塞已经从 `ghcr` 节点侧网络，转成 `Harbor 30002` 统一 `502`。为减少 Harbor 外层代理在当前小集群中的跨节点抖动，已把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/harbor-ui-proxy.yaml` 及其 chart raw 副本更新为“`harbor-ui-proxy` 跟 `harbor-core` 同节点调度”的基线，准备据此重建代理层后再继续把 Headlamp 镜像切到 Harbor。
- 下一步：把新的 `harbor-ui-proxy` 调度策略 apply 到 live，先恢复 Harbor 入口；随后再把 `Headlamp` image 从 `ghcr.io` 收口到 Harbor，并复跑 `30002 / 30087` 入口回归。
- 阻塞/风险：当前控制面/API 仍有偶发 `context deadline exceeded / EOF`；同时 Harbor registry 入口也出现过 `502 / TLS handshake timeout`，所以 Headlamp live 还没完全回绿。

## 2026-03-24
- 完成：排查 `Headlamp` live 不可用时，确认根因不是 chart 或 RBAC，而是节点对 `ghcr.io` 命中了损坏的 IPv6 路径；现场验证表明单纯修改 `/etc/gai.conf` 对 `containerd/kubelet` 不够，真正生效的是节点级关闭 IPv6。已把这一点正式收回仓库真源：`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 现在把 `net.ipv6.conf.{all,default,lo}.disable_ipv6=1` 作为节点基线，`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/BEST_PRACTICES.md`、`README.md`、`TROUBLESHOOTING.md` 也同步改成“关闭节点 IPv6，避免 `ImagePullBackOff`”的正式口径；live 三台节点也都已经下发同样的 `sysctl`。
- 下一步：继续把 `ghcr.io/headlamp-k8s/headlamp:v0.40.1` 收口到更稳的分发路径，优先级是“镜像同步到 Harbor”高于“继续赌公网重试”；如果 Harbor 路径一时打不通，再单独安排节点镜像预热。
- 阻塞/风险：关闭 IPv6 后，`Headlamp` 的失败事件已经从 IPv6 地址切成 IPv4 地址上的 `connection reset by peer`，说明当前剩余问题是 GitHub blob 下载链路本身不稳；我尝试过本地压缩包直接传到节点，但这条 SSH 传输在当前环境里也会长期挂住，所以 Headlamp live 还没有完全回绿。

## 2026-03-24
- 完成：消除前端构建中的两条噪音警告。将 `/Users/simon/projects/webapp-template/web/vite.config.js` 正式改名为 `/Users/simon/projects/webapp-template/web/vite.config.mjs`，避免 Vite 在当前未开启整包 ESM 的 `web` 工程里继续通过 CJS Node API 加载配置；同时同步更新 `/Users/simon/projects/webapp-template/server/Dockerfile` 的前端构建复制路径。另将 `/Users/simon/projects/webapp-template/web/package.json` 中的 `browserslist` 从 `^4.28.0` 升级到 `^4.28.1`，并刷新 `/Users/simon/projects/webapp-template/web/pnpm-lock.yaml`，把 `baseline-browser-mapping`、`update-browserslist-db` 等相关依赖一起带到更新的数据版本。
- 验证：已执行 `cd /Users/simon/projects/webapp-template/web && pnpm build`，构建通过；输出中已不再出现 `The CJS build of Vite's Node API is deprecated`，也不再出现 `baseline-browser-mapping` 数据过期提示。`rg` 也已确认仓库正式引用已从 `vite.config.js` 收口到 `vite.config.mjs`，当前唯一需要同步的构建路径 `/Users/simon/projects/webapp-template/server/Dockerfile` 已更新。
- 下一步：如果后续要继续清理前端工具链噪音，优先处理 `pnpm up` 时暴露的 `eslint-config-airbnb` 与 `eslint@9`、`eslint-plugin-react-hooks@7` 的 peer 依赖不匹配；这属于依赖治理项，不影响当前构建成功。
- 阻塞/风险：这次只做了“消警告”的最小修复，没有升级 `vite` 主版本，也没有把整个 `web` 包切到 `"type": "module"`；当前方案稳定且改动小，但后续若集中升级前端工具链，仍需重新评估 `ESLint / Tailwind / PostCSS` 的模块制一致性。

## 2026-03-23
- 完成：把“最近冷启动验收 / 最近备份检查 / 最近烟雾检查”正式做成可持久化、可视化的值班摘要链路。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/write-lab-ops-summary.sh`，复用 `Alert Sink` 已持久化的 PVC 保存小体量运维摘要；新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-velero-backup-status.sh`；并扩展 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`、`check-webapp-prod-trial-bluegreen.sh`，让三类检查在结束时自动把摘要写到 `Alert Sink`。同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/alert-webhook-receiver.yaml`，增加 `/api/ops/summaries` 与 `/api/ops/summaries/<name>` 读接口；更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，在 Portal 快照区新增三张摘要卡并定时刷新；相关文档 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`OPS_CHECKLIST.md`、`RECOVERY_RUNBOOK.md`、`PROD_TRIAL.md` 已同步收口“脚本执行后会直接刷新 Portal 卡片”的口径。
- 完成：修复 `lab-platform` 发布后的一个真实落地问题。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，在 `lab-platform apply` 完成后自动 `rollout restart` `alert-webhook-receiver` 并等待就绪，避免 `receiver.py` 虽然来自新 ConfigMap、但运行中的 Python 进程仍停留在旧代码，导致新路由 `/api/ops/summaries` 返回 `404`。同时顺手修正了 `check-ha-lab-cold-start.sh` 里 `Argo` 与 `BackupStorageLocation` 输出挤在同一行的问题，保持值班可读性。
- 验证：`bash -n` 已通过 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/write-lab-ops-summary.sh`、`check-velero-backup-status.sh`、`check-ha-lab-cold-start.sh`、`check-webapp-prod-trial-bluegreen.sh`、`helm-release.sh`；嵌入式 `receiver.py` 已用 `python ast.parse` 验证语法，Portal 内联 JS 已用 `node --check` 验证语法；`ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 与 `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 通过。live 已执行 `HELM_FORCE_CONFLICTS=1 SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply` 到 `revision 15`，随后 `alert-webhook-receiver` 已自动滚动到新 Pod。当前 `curl http://192.168.0.108:30086/api/ops/summaries` 已直接返回 `backup / cold-start / smoke` 三份 JSON 摘要；三条检查脚本 live 执行均通过；Playwright 已实测 `http://192.168.0.108:30088/` 页面上能看到三张中文摘要卡，内容分别显示 `nodes 3/3 · urls 6/6`、`bsl Available · schedule webapp-daily paused=false`、`active+preview 6/6 ok`；`30088 / 32668/readyz / 30081/login / 30090/-/ready / 30093 / 30443 / 30086` 当前都返回 `200`，`kubectl get pods -A` 也无 `CrashLoopBackOff / Pending / Terminating`。
- 下一步：如果继续沿这条“高回报、小体量”路线推进，优先考虑补“最近一次恢复演练摘要”或“最近一次 tracing 验证摘要”，而不是继续扩成新的运维数据库或重型状态面。
- 阻塞/风险：这三张 Portal 摘要卡依赖 `Alert Sink` 的 PVC 和 Longhorn 健康，且必须至少跑过一次对应检查脚本才会有内容；另外 `Latest Load Test` 卡片仍依赖当前浏览器已有 GitLab 登录态，Portal 浏览器控制台仍会在未登录时看到一条 GitLab 代理报错，但不影响这次新增的三张运维摘要卡展示。

## 2026-03-23
- 完成：把“不要只靠脚本、要尽量可视化”和“轻量关键运维数据默认持久化”收口到正式仓库规则。更新 `/Users/simon/projects/webapp-template/AGENTS.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/BEST_PRACTICES.md`、`README.md`、`OPS_CHECKLIST.md`、`RECOVERY_RUNBOOK.md`、`TROUBLESHOOTING.md`，明确人工值班默认先看 `Portal / Grafana / Alert Sink / Alertmanager / Argo CD` 等 live 页面，再决定是否执行脚本；同时把“对值班有直接价值且体量可控的数据，不得默认只放内存或 emptyDir”写成显式基线。
- 完成：修复两处高优先级易失态留痕。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/alert-webhook-receiver.yaml`，将 `Alert Sink` 从 `emptyDir` 改为 `1Gi longhorn PVC`，让最近 webhook payload 在 Pod 重启后仍可回看；更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/jaeger.yaml`，把 `Jaeger v2` 从 `memstore` 切到 `Badger + 5Gi longhorn PVC + 7d TTL`，并补了 `initContainer` 与显式 `securityContext`，处理 `uid=10001` 镜像在 Longhorn PVC 上首次建目录的权限问题，保持单副本轻量方案不变，但让最近 traces 不再因 Pod/节点重启直接清空。
- 验证：`ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template`、`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 已通过；live 已执行 `HELM_FORCE_CONFLICTS=1 SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply` 到 `revision 13`。当前 `alert-webhook-receiver-data` 与 `jaeger-data` 均为 `Bound`，`Alert Sink` / `Jaeger` Deployment 更新策略已显式收口为 `Recreate`；`http://192.168.0.108:30086/api/alerts` 当前计数为 `10`，且实测删除 `Alert Sink` Pod 后仍保持 `before=9 after=9`；`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-tracing.sh` 已确认 `jaeger` 收到 `webapp-template.service`，随后实测删除 `Jaeger` Pod 后 `http://192.168.0.108:30686/api/services` 仍可直接返回 `jaeger` 与 `webapp-template.service`。`30088 / 32668/readyz / 30081/login / 30090/-/ready / 30093 / 30443 / 30086 / 30686` 当前均返回 `200`，`kubectl get pods -A` 也已无 `CrashLoopBackOff / Pending / Terminating`。
- 下一步：把“轻量但需要留痕”的扫描继续扩到其他长期运行组件的摘要面，例如最近一次备份 / 最近一次 smoke / 最近一次压测结果，在不明显抬高存储成本的前提下继续从“只在内存或页面瞬时展示”收口到可重启保留的最小持久化。
- 阻塞/风险：`Jaeger Badger` 适合当前单实例实验室场景，但不适合横向扩容；后续如果 tracing 流量显著增大，仍需要单独评估外部存储后端。`Alert Sink` 和 `Jaeger` 都已做轻量持久化，但它们依赖 Longhorn，Longhorn 自身健康仍是这套 VM 级 HA 的前置条件。

## 2026-03-23
- 完成：把这次“三台 VM 重启后 kubelet 因 swap 恢复而全部起不来”的事故回收到正式节点基线和恢复口径。增强 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh`，让节点初始化脚本现在会持久关闭 swap、同步改 `/etc/fstab`、写入 `overlay / br_netfilter / iscsi_tcp` 模块加载配置、落最小 `sysctl` 基线，并安装 `open-iscsi / nfs-common / conntrack / ebtables / ethtool` 等依赖；同时新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`，把“节点基线 -> K8s 节点/Pod -> GitOps/Velero -> Portal/WebApp/Grafana/Prometheus/Alertmanager/Argo CD 入口”收口成一条可重复执行的冷启动验收链路。同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`ha-lab-runbook.md`、`RECOVERY_RUNBOOK.md`、`TROUBLESHOOTING.md`、`OPS_CHECKLIST.md`，明确当前虚拟机级 HA 至少要通过 reboot-safe 基线和冷启动验收，不能再只做“运行中删 Pod / 漂移”演练就默认可上生产。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 已通过；live 环境已按新口径实测恢复，`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide` 回到三节点 `Ready`，并且 `http://192.168.0.108:30088/`、`32668/readyz`、`30081/login`、`30090/-/ready`、`30093/`、`30443/` 当前均返回 `200`。
- 下一步：把这条冷启动验收链路继续往前收口到节点交付流程，至少在每次内核升级、宿主机维护、节点模板更新或三节点 reboot 演练后固定执行一次，并考虑再补“顺序重启三节点”的脚本化演练。
- 阻塞/风险：这轮先把“虚拟机级生产 HA”最明显的 reboot-safe 缺口补上了，但仍属于同宿主机实验室边界；后续若继续对外承诺更高等级的 HA，还需要把硬件故障域、独立电源/存储网络和更完整的冷恢复演练单独纳入验收。
- 完成：修复 `Portal` 里 `Prod-Trial Active / Preview` 两张入口卡片“能看见但点不开”的问题。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，不再让浏览器直接访问 `nip.io` host，而是在 `lab-portal` 自带的 nginx 上新增两个独立整站代理端口：`30089 -> active`、`30091 -> preview`，统一复用已经在 blackbox 和 runbook 中验证通过的 `192.168.0.108:32668 + Host` 路径。这样既绕开客户端 DNS / 本地域名解析问题，也避免根路径 SPA 在子路径代理下出现资源和路由失效。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 已完成，`lab-portal` Deployment 已滚动成功，`kubectl -n lab-portal get svc lab-portal` 已确认 Service 对外暴露 `80:30088`、`8080:30089`、`8081:30091`。随后通过 `curl http://192.168.0.108:30088/` 回读确认 Portal 首页已换成 `30089 / 30091` 两条新链接，再分别通过 `curl http://192.168.0.108:30089/`、`curl http://192.168.0.108:30091/` 和对应 `/assets/index.BQaWnRXT.js` 确认 active / preview 首页和静态资源都返回 `200`。
- 下一步：如果这两条代理入口稳定，可再把 active / preview 当前健康状态以只读小条嵌回 Portal，减少在 Portal、Grafana、Argo 之间来回跳转。
- 阻塞/风险：这次把入口从 `nip.io` 收口成固定 NodePort，前提仍然是访问端能到 `192.168.0.108:30089 / 30091`；如果后续入口 IP 从单节点切到统一 VIP 或独立域名，需要同步更新 Portal 链接与 nginx 代理目标。
- 完成：继续按“只改展示名、不动 namespace”的原则收口 `lab-ha`。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-gitops-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/grafana-lab-gitops-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，把对人展示的名字统一成 `WebApp Lab / WebApp Prod-Trial Active / WebApp Prod-Trial Preview`。底层技术真名仍保持 `webapp`、`webapp-prod-trial`、`webapp-template-lab`、`webapp-template-prod-trial`，避免现在为了展示名再引发一轮 namespace / Argo / metrics 漂移。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f .../platform-portal.yaml` 与 `.../grafana-lab-gitops-dashboard.yaml` 已通过；live 已完成 `kubectl apply`，`lab-portal` Deployment 已重启滚动成功。随后通过 `curl http://192.168.0.108:30088/` 回读确认首页已显示 `WebApp Lab Portal`、`WebApp Lab`、`WebApp Prod-Trial Active`、`WebApp Prod-Trial Preview`；并通过 `curl -u admin:Grafana123! http://192.168.0.108:30081/api/dashboards/uid/lab-ha-gitops` 确认 dashboard 标题已变为 `WebApp Lab / GitOps & Release`，且 panel 中出现 `WebApp Lab Synced` 与 `Naming Notes`。
- 下一步：若还要继续收口用户入口，建议下一轮给 `WebApp Lab` 也补一个和 `30089 / 30091` 同风格的稳定代理入口，彻底把 `32668` 从人类日常入口里隐藏掉。
- 阻塞/风险：这轮 docs 文案虽然已经在本地仓库改好，但尚未提交推送，所以 GitLab 上通过仓库页面查看到的 `ACCESS.md / README.md` 仍会保持旧说法；当前只有 live Portal / Grafana 已体现新口径。

## 2026-03-22
- 完成：继续把 `Portal` 从“只给交付看板入口”收口成“可直接点 active / preview 入口”的发布操作前置页。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，在 `Delivery` 卡片旁新增两张强调样式卡片：`Prod-Trial Active` 和 `Prod-Trial Preview`，分别直达 `http://webapp-trial.192.168.0.108.nip.io/` 与 `http://webapp-trial-preview.192.168.0.108.nip.io/`；同时补了对应中英文文案与轻量高亮样式，保持 Portal 仍是静态入口页，不直接承载 promote / abort 操作。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 已完成，`lab-portal` Deployment 已在 `lab-portal` 命名空间滚动成功；`curl http://192.168.0.108:30088/` 现已能看到 `Prod-Trial Active` / `Prod-Trial Preview` 两张新增卡片和对应中英文文案。
- 下一步：如果你还想继续收口发布操作面，下一轮最直接的是给这两张卡片旁边再补一个只读状态条，把 active/preview 当前黑盒探测结果和 Argo 健康状态直接嵌回 Portal，而不是只跳 Grafana。
- 阻塞/风险：这两张卡片本质上仍然依赖 host-routed `nip.io` 入口；在极端客户端 DNS 或本地网络受限时，用户可能仍需要回退到 Grafana/Argo 看状态，或者用 `check-webapp-prod-trial-bluegreen.sh` 走 NodePort + Host 头验证。

## 2026-03-22
- 完成：继续把 `lab-ha` 的发布可视化收口到 live `Portal`。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，仅保留与 `prod-trial` 蓝绿发布相关的最小文案改动：`Delivery` 卡片改成指向 `prod-trial blue-green active/preview` 发布信号，`GitOps` quick note 明确提示去 delivery dashboard 看蓝绿状态，同时刷新 Portal curated 日期；没有把工作区里不属于这次任务的其他 Portal 现场改动一并带进来。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 已完成，`lab-portal` Deployment 已在 `lab-portal` 命名空间重启并滚动成功；`curl http://192.168.0.108:30088/` 现已返回更新后的英文与中文文案，确认首页已显示 “prod-trial blue-green active/preview release signals” / “prod-trial 蓝绿发布状态统一看交付看板”，且不再额外带入本轮未准备上线的治理卡片。
- 下一步：如果还要继续往“发布操作面”收口，可以下一轮再把 Portal 上的 `prod-trial active` / `preview` 入口做成显式按钮，减少用户在 Grafana 和 Argo 之间来回跳转的成本。
- 阻塞/风险：Portal 当前仍是静态入口页，负责引导看板而不是直接发起 promote / abort；如果后续要把蓝绿操作也收进 Portal，需要单独设计鉴权、风险提示和回滚保护，不能直接在现有静态页里硬塞按钮。

## 2026-03-22
- 完成：为 `webapp-prod-trial` 落地一套最小可用的蓝绿发布链路，并把可视化入口一起收口进现有 `lab-ha` 交付面。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/templates/deployment.yaml`、`rollout.yaml`、`rollout-analysis-template.yaml`、`rollout-preview-service.yaml`、`ingress.yaml` 及对应 values，让 `lab` 继续走普通 `Deployment`，而 `prod-trial` 改为 `Argo Rollouts` 蓝绿：保留 active Service `webapp-template-prod-trial`，新增 preview Service `webapp-template-prod-trial-preview`，并通过 NodePort + Host 头的 `readyz` 检查做 pre/post promotion 验证，默认保留 `180s` 观察窗口。同步把模板条件判断收口成“缺省 `rollout` 也能安全渲染”，避免 `lab` 或其他未开启蓝绿的 values 因 nil 值直接渲染失败。同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/blackbox-values.yaml`、`grafana-lab-gitops-dashboard.yaml`、`platform-portal.yaml`，把 `prod-trial active/preview` 探测、Argo CD 健康状态和交付说明接入现有 `HA Lab / GitOps & Delivery` 看板与 Portal 文案；新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh`，并同步更新 `PROD_TRIAL.md`、`INTERNAL_DNS.md`、`ACCESS.md`、`server/deploy/lab-ha/docs/README.md`。在 live 验证阶段又把 `blackbox` 的 `prod-trial active/preview` 探测从直接打 `nip.io` host 收口成 `NodePort + Host` 头的双 module，避免集群内 DNS/路由差异导致 `probe_success=0`。
- 验证：`helm lint server/deploy/lab-ha/charts/webapp-template -f ...values-lab.yaml` 与 `helm lint ... -f ...values-prod-trial.yaml -f ...values-prod-trial-internal.yaml` 都已通过；`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh` 通过；`ruby -rpsych -rjson` 已确认 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-gitops-dashboard.yaml` 内嵌 dashboard JSON 合法；`helm template ...values-prod-trial.yaml -f ...values-prod-trial-internal.yaml | kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f -` 已确认 `AnalysisTemplate`、`Rollout`、preview `Service` 与相关对象均能被集群 schema 接受；`webapp-template-prod-trial` 已实际 sync 到 `89c5529`，live `prod-trial` 现已只剩 `Rollout + preview Service + AnalysisTemplate` 主链路，旧 `Deployment` 已清理；`check-webapp-prod-trial-bluegreen.sh` 对 active/preview 两条入口的 NodePort + Host 检查均返回 `200`；Prometheus live `probe_success{target=~"webapp-prod-trial-(active|preview)"}` 现已回到 `1`，`probe_http_status_code` 为 `200`，说明 `HA Lab / GitOps & Delivery` 看板上的 active/preview 探测已能出数。
- 下一步：如果后续要把这套蓝绿再做成更完整的发布操作面，可以单独清理 Portal 相关现场改动后，把 delivery 入口文案也同步到 live；另外如果要做业务级自动门禁，优先补关键接口 smoke 或业务 SLI，再考虑接更激进的自动 promotion。
- 阻塞/风险：当前自动发布验证主要依赖 active/preview `readyz` 与 blackbox 探测，仍不是业务级 SLI；如果后续要把这套蓝绿继续升级成更强自动化门禁，仍建议再补更稳定的业务指标或关键接口 smoke 信号。live 验证还额外暴露了两个第三方集成细节：一是 `blackbox-values.yaml` 里的 `serviceMonitor.defaults.labels` 不会自动落到新 target 生成的 `ServiceMonitor.metadata.labels`，需要显式补 `release: kube-prometheus-stack`；二是现场已有的 blackbox release 对新 target 的 values 变更没有一次性干净回收到 live `ConfigMap / ServiceMonitor`，这次是通过手工 patch + operator/reload 收口的，后续仍建议找时间把这条 Helm 管理链路彻底清干净。仓库里当前还存在若干本轮之外的未提交现场改动与新文件，这次没有回滚它们，只在现有基础上补了蓝绿发布相关变更。

## 2026-03-22
- 完成：继续补强全局 `/Users/simon/.codex/AGENTS.md` 与项目级 `/Users/simon/projects/webapp-template/AGENTS.md`，显式加入“注释遵循最小必要原则”与“模板行为/初始化规则/部署路径/runbook/页面文案/接口/配置变化时，必须同轮同步更新相关注释和正式文档”的约束，避免后续 AI 因注释膨胀或说明滞后把现场过程误认成当前模板基线。
- 验证：本次仅调整协作约定文档，未执行自动化测试。
- 下一步：继续按这套约束扫 `lab-ha`、部署脚本和关键 runbook，把仍残留的历史过程性注释逐步收口。
- 阻塞/风险：规则能约束后续新增漂移，但仓库里已存在的现场说明和 raw 文件仍需要后续触达时继续清理。

## 2026-03-22
- 完成：继续补强 `/Users/simon/projects/webapp-template/AGENTS.md` 与全局 `/Users/simon/.codex/AGENTS.md` 的注释治理规则，明确提交到仓库的注释必须直接描述当前模板行为、边界和依赖关系，不能长期保留“新增 / 修复 / 关键修复 / 保持原有代码”或 `⭐✅⚠️` 这类补丁历史口吻，避免后续 AI 把现场过程信息误认成模板正式基线。
- 完成：同步清理 `server/internal/server/http.go` 与 `web/src/common/utils/jsonRpc.js` 的高风险注释，把“新增 Data 配置”“自动带 token”这类补丁历史式写法改成当前行为说明，和新约束保持一致。
- 验证：本次仅调整 AGENTS 与注释文本，未执行自动化测试。
- 下一步：继续优先扫 `lab-ha`、部署脚本和关键服务端入口，找仍可能把现场过程写成当前规则的注释。
- 阻塞/风险：模板仓库仍保留不少现场 runbook 与 manifests，后续扫描还可能继续发现需要收口的历史注释或说明。

## 2026-03-22
- 完成：把 Portal 的“运行压测”从“跳 GitLab 新建页”收口成真正的站内直触发。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，为首页 `运行压测` 卡片和“最近一次压测”按钮增加同源直触发逻辑：Portal 先通过 `/gitlab/.../-/pipelines/new?ref=master` 代理页读取 GitLab `csrf-token`，再通过 `/gitlab/api/graphql` 复用当前浏览器登录态调用 `internalPipelineCreate` mutation，默认创建安全的 `system` 场景，并固定携带 `LOADTEST_BASE_URL` 与 `LOADTEST_PROMETHEUS_RW_URL`。同时补了 Portal 内的触发中/已触发/失败状态文案、busy 态样式和轮询逻辑；轮询现在会一直等到当前这轮 `loadtest_lab` 进入 `success/failed` 终态，再把卡片切到 `打开看板 / 打开报告`，避免过早停在 `pending/running`。
- 验证：已三次 live 发布 `lab-portal` 并完成 `rollout restart`；浏览器实际打开 `http://192.168.0.108:30088/?v=portal-direct-trigger-live-3` 后，点击首页 `运行压测` 卡片不会离开 Portal，而是直接把卡片切成 `排队中`，展示 `system · Pipeline #45 · 03/22 12:39` 与 `打开当前流水线`；随后等待轮询完成，卡片已自动刷新为 `通过`、`system · p95 14ms · 03/22 12:41`、`引擎 k6，当前这轮已写入 Grafana 时序。`，并给出 `打开当前流水线 -> Pipeline #45`、`打开看板 -> var-testid=gitlab-45-80-system`、`打开报告 -> /loadtest-report.html?job_id=80` 三个入口。Prometheus 也已查到 `sum(k6_http_reqs_total{testid=\"gitlab-45-80-system\"})=200`，说明这轮 Portal 直触发确实写入了 Grafana 链路。
- 下一步：如果后续还想继续提高 Portal 完整度，可再把 `system` 之外的场景选择做成 Portal 内小面板，而不是要求去 GitLab 页改变量；当前这不是阻塞项，因为“默认安全场景一键触发 + 自动出图/出报告”的主路径已经完整。
- 阻塞/风险：Portal 直触发依赖当前浏览器已经登录过 GitLab；如果未登录，Portal 只能退回 `登录 GitLab / 运行压测` 引导。当前 Portal 仍只直触发安全默认的 `system` 场景，`auth/mixed` 这类会写业务数据的场景仍建议留给 GitLab 页手动改变量。Grafana 前端既有的偶发控制台报错仍存在，但不影响这轮 Portal -> GitLab -> Prometheus/Grafana -> Portal 的结果展示。

## 2026-03-22
- 完成：继续把压测能力从“脚本入口”收口到 Portal 可视化入口。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`，让 `最近一次压测` 卡片不再只显示状态摘要，而是额外展示本轮引擎明细（`k6` / `curl-fallback`）、并按实际结果拆成 `打开当前流水线 / 打开看板 / 打开报告` 三个按钮；当最近一次任务为 `k6 + Prometheus remote write` 时，Portal 会直接给出带 `var-testid` 的 Grafana 深链；当任务退化到 `curl-fallback` 时，则明确提示“只有报告产物，没有 Grafana 时序”。
- 验证：已重新渲染 `lab-platform` 原始文件并 `kubectl apply` 到 live，随后重启 `lab-portal` Deployment；浏览器实际打开 `http://192.168.0.108:30088/?v=visual-loadtest-card` 后，`最近一次压测` 卡片已显示 `通过`、`system · p95 15ms · 03/22 12:01`、`引擎 k6，当前这轮已写入 Grafana 时序。`，并同时出现 `打开当前流水线 -> Pipeline #41`、`打开看板 -> Grafana var-testid=gitlab-41-72-system`、`打开报告 -> /loadtest-report.html?job_id=72` 三个入口，说明“Portal 看状态 -> 点看板 / 点报告”的主路径已经可直接使用。
- 下一步：如果后续还要继续弱化 GitLab 原始页面的存在感，可再把 Portal 上的 `打开看板` 默认指向官方 k6 看板或补一个更聚合的压测详情页；当前这不是阻塞项，因为用户已经可以只通过 `30088` 发现入口并跳到可视化结果。
- 阻塞/风险：Portal 当前仍是轻量聚合层，不是执行器；“运行压测”按钮依旧会跳到 GitLab 预填变量页，而不是在 Portal 内直接触发流水线。现有 Portal 逻辑依赖浏览器里已有 GitLab 登录态；若未登录，卡片会退回到“登录 GitLab / 运行压测”引导。Grafana 看板本身仍带既有前端控制台报错，但目前不影响出图。

## 2026-03-22
- 完成：继续补强 `/Users/simon/projects/webapp-template/AGENTS.md` 的注释治理规则，明确“大段注释掉的旧实现、现场补丁历史和临时兜底分支若已不再代表当前模板基线，应优先删除、改写成简洁说明或收口到正式 runbook”，避免后续 AI 把注释掉的应急路径或现场痕迹继续当成模板主路径。
- 验证：本次仅调整协作约定文档，未执行自动化测试。
- 下一步：继续优先清理 `lab-ha` 相关脚本、runbook 和 raw manifests 里的历史痕迹型注释，保持 AGENTS 规则与实际仓库状态一致。
- 阻塞/风险：当前最明显的 load test 基线漂移已收口，但 `lab-ha` 下仍存在现场 runbook 和 raw 文件并存的客观复杂度，后续扫描还可能继续发现需要精简的历史说明。

## 2026-03-22
- 完成：在高风险注释专项扫描中，继续修正 `/Users/simon/projects/webapp-template/scripts/loadtest/run.sh` 的误导性注释。`ensure_go_k6_binary()` 旁的注释现已明确：`go install k6` 只适用于“本地临时机/一次性环境”的兜底，不是 `GitLab shell runner` 的推荐基线，避免后续 AI 根据代码注释又把 runner 主路径写回“现场 go install / 在线补下载”。
- 验证：本次仅调整脚本注释，未执行自动化测试。
- 下一步：继续优先扫描 load test、部署和值班脚本中的注释与 runbook，找出仍可能把“fallback / 应急路径”误写成“正式基线”的位置。
- 阻塞/风险：当前 load test 文档与关键脚本注释已基本收口到同一口径，但 `lab-ha` 目录仍存在较多现场 runbook 与 raw manifests；后续若继续演进部署主路径，仍需持续同步文档和脚本注释。

## 2026-03-22
- 完成：在高风险注释/文档专项扫描中，先修正压测文档里最容易误导 AI 的 `k6` 基线表述。`scripts/loadtest/README.md` 与 `server/deploy/lab-ha/docs/LOAD_TEST.md` 现已明确：自动下载 `k6`、`go install`、`docker run grafana/k6` 只适用于“本地临时机/一次性环境”，当前 `GitLab shell runner` 的正式推荐基线仍然是宿主机预装固定版本 `k6`，避免后续 AI 看到 fallback 描述后又把在线下载写回 runner 主路径。
- 验证：本次仅调整文档说明，未执行自动化测试。
- 下一步：继续扫描部署与值班 runbook，优先找“某次现场兜底流程”是否被写成“当前正式主路径”的位置，再决定是否继续收口。
- 阻塞/风险：本次只修了最容易让 AI 把 fallback 当 baseline 的压测文档；`lab-ha` 下仍存在一些保留现场痕迹的 runbook/manifest 说明，后续扫描可能还会发现需要继续补“真源优先级”提示的地方。

## 2026-03-22
- 完成：继续收紧 `/Users/simon/projects/webapp-template/AGENTS.md` 的注释与文档规则，明确“当前任务触达的文件若存在明显过期、误导或与当前代码/模板正式规则冲突的注释，应在同一轮顺手修正”，并新增“局部脚本注释、单份 runbook 或某次现场记录只能作为线索，不能覆盖模板文档优先级”的约束，降低后续 AI 被旧注释、旧 runbook 或单次现场记录带偏的风险。
- 验证：本次仅调整协作约定文档，未执行自动化测试。
- 下一步：继续对 `webapp-template` 做高风险注释与文档专项扫描，优先覆盖模板初始化、部署真源和 load test / lab-ha 相关 runbook，找出仍可能误导新对话 AI 的位置。
- 阻塞/风险：规则能防止新增错误继续扩散，但仓库内若仍保留历史现场口径、过期 runbook 或旧注释，仍需要后续专项扫描逐步清理，不能只靠 AGENTS 自行消失。

## 2026-03-22
- 完成：在 `/Users/simon/projects/webapp-template/AGENTS.md` 增加“模板文档阅读优先级”约束，明确后续 AI 涉及模板初始化收口、默认模块裁剪、部署真源、Compose 与 `lab-ha` 边界、服务端运行/配置/接口/可观测性时，必须先按 `docs/project-init.md -> docs/deployment-conventions.md -> server/docs/README.md / server/deploy/README.md` 的顺序建立上下文，避免新对话只翻 `progress.md` 或把某次现场部署记录误当成模板正式规则。
- 完成：同步把“哪类文档是当前正式口径、哪类只用于过程追溯”的边界写入 `AGENTS.md`，明确 `docs/project-init.md` 和 `docs/deployment-conventions.md` 分别是模板初始化与部署边界的优先真源，`progress.md` 只能补充现场演进原因和未完全回收的 drift，不能单独作为规则真源。
- 验证：本次仅调整协作约定文档，未执行自动化测试。
- 下一步：如果后续派生项目初始化时，AI 仍容易混淆“模板默认骨架”和“当前 live 实验环境口径”，可以再补一个更短的 docs 首页“AI 快速阅读顺序”段落；在那之前先观察 `AGENTS.md` 这层约束是否已经足够。
- 阻塞/风险：该约束只能提升 AI 的阅读顺序稳定性，前提仍然是 `docs/project-init.md`、`docs/deployment-conventions.md` 和各专题 README 保持持续更新；如果未来规则已经变化但文档未回写，AI 仍会稳定地读到过期信息。

## 2026-03-22
- 完成：按当前实验规模的最佳实践，把 `k6` 从“GitLab job 现场外网下载”收口为“runner 宿主机固定安装 + 仓库脚本固化”。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-runner-k6.sh`，支持在本机先下载或必要时本机 `go` 交叉编译 `linux/amd64` 版 `k6 v0.49.0`，再通过 SSH 分发到 `root@192.168.0.108`，固定落到 `/opt/lab-tools/k6/v0.49.0/k6`，并把 `/usr/local/bin/k6` 链接到该版本；同时更新 `/Users/simon/projects/webapp-template/scripts/loadtest/run.sh`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/LOAD_TEST.md`、`/Users/simon/projects/webapp-template/scripts/loadtest/README.md`，明确宿主机预装是 GitLab shell runner 的推荐路径，在线下载只作临时机或应急兜底，并补了 `LOADTEST_K6_DOWNLOAD_URL` 以便后续若要切内网镜像源，无需再改主逻辑。
- 验证：已实际执行 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-runner-k6.sh`，确认 `node2` 上 `/usr/local/bin/k6` 与 `gitlab-runner` 用户都能输出 `k6 v0.49.0`；随后用真实 GitLab 一键入口触发 `Pipeline #41 / Job #72`，日志已明确显示使用本机 `k6` 和 `Prometheus remote write`，不再出现 `loadtest engine=curl-fallback`；Prometheus 已能查询到 `testid=gitlab-41-72-system`，其中 `sum(k6_http_reqs_total)=158`、`sum(k6_iterations_total)=79`；Grafana `HA Lab / Load Test` 看板在 `var-testid=gitlab-41-72-system` 下已显示 `Requests Total=158`、`Iterations Total=79`、`Worst P95 Req Duration=15.8 ms`、`Max VUs=2`；Portal 最新摘要也已更新为 `system · p95 15ms · 03/22 12:01`。
- 下一步：如果后续还要进一步去掉“宿主机状态”属性，可再补一层内网 `k6` 分发源或主机初始化脚本，把 `install-runner-k6.sh` 纳入 runner 换机/重装 checklist；当前这不是阻塞项，因为 GitLab 一键压测到 Grafana 的主链路已经恢复。
- 阻塞/风险：当前最佳实践是在 `192.168.0.108` 这台 runner 宿主机上固定安装版本化 `k6`，这比每轮外网下载稳定得多，但它仍然属于主机基线能力；如果后续 runner 宿主机重装、迁移或更换，需要重新执行安装脚本，不能假设新机器天然具备 `k6`。`curl-fallback` 仍然保留作应急路径，但它不会写入 Grafana。

## 2026-03-22
- 完成：把压测时序接入现有 `Prometheus + Grafana`。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/kube-prometheus-stack-values.yaml`，为 `prometheus.prometheusSpec` 打开 `enableRemoteWriteReceiver: true`；更新 `/Users/simon/projects/webapp-template/scripts/loadtest/run.sh` 与 `/Users/simon/projects/webapp-template/.gitlab-ci.yml`，在 `k6` engine 可用时支持 `LOADTEST_PROMETHEUS_RW_URL`，并统一给 remote write 指标打 `testid / loadtest_scenario / loadtest_source` 标签，保留原有 `report.html + summary.json` artifacts 不变。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-loadtest-dashboard.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-loadtest-official-dashboard.yaml`，分别提供实验室精简看板 `HA Lab / Load Test` 和官方适配版 `HA Lab / Load Test (Official k6)`；Portal `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 也新增了 `Load Test Dashboard / 压测看板` 与 `Official k6 Dashboard / 官方 k6 看板` 两个入口；文档 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/LOAD_TEST.md`、`/Users/simon/projects/webapp-template/scripts/loadtest/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 已同步收口 Grafana 口径。
- 验证：`curl -X POST http://192.168.0.108:30090/api/v1/write` 现在已从 `404` 变成 `400 snappy: corrupt input`，确认 remote write receiver live 生效；本地已实际运行 `LOADTEST_RUN_ID=lt-grafana-smoke` 的 `system` 场景，把 `k6_*` 指标写入 live Prometheus，并确认存在 `testid=lt-grafana-smoke`、`loadtest_scenario=system`、`loadtest_source=manual-smoke` 标签；Grafana API 已能检索到 `uid=lab-ha-loadtest` 与 `uid=lab-ha-loadtest-official` 两张 dashboard，浏览器实际打开 `http://192.168.0.108:30081/d/lab-ha-loadtest/ha-lab-load-test?var-testid=lt-grafana-smoke` 后，已显示 `Requests Total=32`、`Iterations Total=16`、`Worst P95 Req Duration=438 ms`、`Max VUs=1`；浏览器实际打开 `http://192.168.0.108:30081/d/lab-ha-loadtest-official/ha-lab-load-test-official-k6?orgId=1&var-testid=lt-grafana-smoke` 后，官方板也已显示 `HTTP requests=32`、`Peak RPS=3.62 req/s`、`HTTP Request Duration=235 ms` 等指标；Portal `http://192.168.0.108:30088` 也已出现 `Load Test Dashboard / 压测看板` 与 `Official k6 Dashboard / 官方 k6 看板` 卡片。另：`SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh template` 已确认两个 dashboard 与 Portal 入口都在渲染结果中。
- 下一步：如需让 GitLab 一键压测默认也把指标写进 Grafana，需要把本地更新后的 `.gitlab-ci.yml` 提交并推送到远端仓库；同时若后续要彻底收敛部署路径，还需单独处理 `lab-platform` live 资源缺少 Helm ownership metadata 的历史问题，再把手工 `kubectl apply` 路径收回到 Helm。
- 阻塞/风险：本次 `kube-prometheus-stack` 的 `helm upgrade` 仍被现场已有的 `kubectl patch / kubectl set image / client-side apply` managed fields 冲突拦住，因此 remote write receiver 实际是通过已落地到 live 的 Prometheus CR 配置生效，而不是一次干净的 Helm apply 收口；`Grafana` 两张看板当前只覆盖 `k6` engine，若某轮任务退化到 `curl-fallback`，仍需回看 GitLab artifacts；官方板在浏览器里已出数，但 Grafana 前端仍偶发既有 `TypeError: Cannot read properties of undefined (reading 'keys')` 控制台错误，当前不影响看板渲染；另外当前工作区里 `.gitlab-ci.yml` 的更新还未推到远端，所以 `192.168.0.108:8929` 上现有一键压测流程暂时还不会自动带上 remote write 参数。

## 2026-03-22
- 完成：修复 `Portal 首页已更新但浏览器仍缓存旧版“打开报告”链接` 的问题。为 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml` 的 `nginx location /` 增加 `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`、`Pragma: no-cache` 与 `expires -1`，明确禁止首页与静态入口页被浏览器继续缓存成旧版本；保持 `loadtest-report.html` 在线预览页不变，`打开报告` 仍统一走 `30088/loadtest-report.html?job_id=<id>`。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=client -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 通过；live `apply + rollout restart/status` 已完成；`curl --noproxy '*' -I http://192.168.0.108:30088/` 已返回 `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` 与 `Pragma: no-cache`；同时用浏览器带登录态访问带时间戳的新首页 `http://192.168.0.108:30088/?v=<ts>`，已确认 `打开报告` 的实际 href 为 `http://192.168.0.108:30088/loadtest-report.html?job_id=62`，不再指向 GitLab artifact 明细页。
- 下一步：如果还要继续优化体验，可以把 Portal 首页按钮从纯链接升级成一个更显眼的“查看最新报告”固定入口，减少用户在旧标签页上误点历史链接的概率。
- 阻塞/风险：如果用户浏览器当前仍停留在旧标签页，未重新请求 `30088` 首页时，历史 DOM 里的旧链接仍会继续存在；这属于浏览器当前标签页的既有状态，不是新 Portal 配置失效。

## 2026-03-21
- 完成：把压测报告入口从“GitLab artifact 明细页”改成“Portal 在线预览页”。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，新增 `loadtest-report.html` 页面；该页面会通过 Portal 现有的同源 GitLab 代理拉取 `report.html` artifact 内容，并直接写入 iframe 在线渲染，避免 GitLab 对 HTML artifact 的强制下载/不预览行为。同时把首页 `Latest Load Test` 卡片里的 `打开报告` 链接改成 `/loadtest-report.html?job_id=<id>`，并同步到 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`；随后已 live apply 到 `lab-portal` 并完成 rollout。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=client -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 通过，live apply 与 `rollout restart/status` 已完成；`curl --noproxy '*' -fsS 'http://192.168.0.108:30088/loadtest-report.html?job_id=58'` 已能返回新的 `Load Test Report Viewer` 页面；Playwright 已实际打开 `http://192.168.0.108:30088/loadtest-report.html?job_id=62`，确认 `Job #62` 的报告在 Portal 内在线渲染，且首页 `打开报告` 的实际 href 已变成 `http://192.168.0.108:30088/loadtest-report.html?job_id=62`，不再落到 GitLab artifact 明细页。
- 下一步：如果还要继续提升体验，可以把这个预览页再补“打开流水线 / 打开 Job / 返回最近一次压测”的更多上下文导航，或者再加一个“直接看最新报告”的固定 URL。
- 阻塞/风险：在线预览依旧依赖当前浏览器具备 GitLab 登录态；如果未登录 GitLab，Portal 只能提示先登录，不能绕过 GitLab 权限直接暴露 artifact 内容。

## 2026-03-21
- 完成：完成 shell runner 一键压测链路的 live 收口。提交 `f8d0c18 fix(loadtest): 为 shell runner 增加 curl 兜底` 已推送到 `origin`、`gitlab`；随后在 GitLab 手动触发 `Pipeline #34`，使用 `LOADTEST_SCENARIO=system`、`LOADTEST_DURATION=5s`、`LOADTEST_VUS=1`，并额外设置 `LOADTEST_K6_VERSION=v0.0.0` 强制命中新加的 fallback 路径，验证 shell runner 在下载 `k6` 超时后会自动切换到仓库内置 `curl fallback`，同时仍把固定 artifacts 写到 `server/deploy/lab-ha/artifacts/loadtest/job/`。
- 验证：`Pipeline #34 / Job #58` 已在 live GitLab 成功通过；trace 已确认顺序为“下载版 `k6` 在 15s 超时 -> 切换 `curl-fallback` -> 产出 `summary.json` / `report.html` -> 上传 artifacts”；随后在 `http://192.168.0.108:30088` 验证 `Latest Load Test` 卡片已更新为 `通过`，摘要显示 `system · p95 20ms · fail 0% · 03/21 11:42`，并且 `打开当前流水线` 指向 `Pipeline #34`、`打开报告` 指向 `Job #58` 的固定报告地址。
- 下一步：如果要继续提升集中可视化，下一轮优先把 `Latest Load Test` 从“最近一次 job 摘要”扩展成带更多关键指标或 Grafana Dashboard 直达入口，但执行真源仍保持在 GitLab 和 artifacts，不把 Portal 做成新的任务执行器。
- 阻塞/风险：默认一键路径已经稳定，但 `auth/mixed` 依旧依赖可用 `k6` 环境；Portal 当前展示的是最近一次 job 摘要，不是完整趋势看板，长期趋势仍需接现有 Grafana。

## 2026-03-21
- 完成：收口 GitLab 一键压测在 shell runner 上的外网依赖问题。为 `/Users/simon/projects/webapp-template/scripts/loadtest/run.sh` 增加下载版 `k6` 的连接/总时长超时，避免 runner 在 GitHub release URL 上无限卡住；新增 `/Users/simon/projects/webapp-template/scripts/loadtest/curl_fallback.sh`，在没有可用 `k6/go/docker` 时为 `health/system` 自动退化到仓库内置 `curl` 压测，并继续产出 Portal 兼容的 `summary.json`、`report.html` 与 `meta.env`。同时修正 `/Users/simon/projects/webapp-template/scripts/loadtest/auth.js` 对 GitLab 变量名的兼容，`LOADTEST_AUTH_ITERATIONS` 现在会正确映射到 `auth` 场景迭代次数；文档 `/Users/simon/projects/webapp-template/scripts/loadtest/README.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/LOAD_TEST.md` 已同步说明新的 fallback 行为与边界。
- 验证：`bash -n /Users/simon/projects/webapp-template/scripts/loadtest/run.sh && bash -n /Users/simon/projects/webapp-template/scripts/loadtest/curl_fallback.sh` 通过；`docker run --rm -v /Users/simon/projects/webapp-template:/workspace -w /workspace grafana/k6:latest inspect /workspace/scripts/loadtest/auth.js` 通过；本地在模拟“无 k6 / 无 docker / 无 go”环境下执行 `PATH="/usr/bin:/bin:/usr/sbin:/sbin" LOADTEST_K6_VERSION=v0.0.0 LOADTEST_K6_DOWNLOAD_MAX_TIME=5 BASE_URL=http://192.168.0.108:32668 LOADTEST_RUN_ID=lt-curl-system-local K6_WEB_DASHBOARD=false bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh system --vus 1 --duration 3s` 与同条件 `... run.sh health --vus 1 --duration 3s` 均成功，结果已落到 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/loadtest/lt-curl-system-local/`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/loadtest/lt-curl-health-local/`；其中 `summary.json` 已确认包含 Portal 读取的 `http_req_duration.p(95)` 与 `http_req_failed.rate`。
- 下一步：提交并推送这批 fallback 修复，随后取消当前卡住下载的 GitLab `Pipeline #32 / Job #54`，重新触发一轮 live `system` 压测，验证 `loadtest_lab` 在 runner 上真正完成，并检查 `http://192.168.0.108:30088` 的 `Latest Load Test` 卡片是否更新为最新结果。
- 阻塞/风险：`curl fallback` 当前只覆盖最安全的 `health/system`；如果用户在 GitLab 页手动切到 `auth/mixed`，runner 仍需要可用 `k6` 环境，否则会继续失败。这是为了先保证默认一键路径稳定，而不是在当前复杂度预算下重写整套鉴权压测引擎。

## 2026-03-21
- 完成：把压测入口正式并入高可用实验 Portal，并收口过期静态内容。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，新增 `Load Test Guide` 卡片与 `LOAD_TEST.md` 文档入口，同时把 Portal 的 snapshot 区从写死的 pipeline 编号、备份时间、告警时间改成“去 GitLab / Argo CD / Grafana / Alertmanager 看 live truth”的口径，并增加 `Portal Curated 2026-03-21` 标记，明确这张页是导航与说明，不是实时状态真源；随后通过 `ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml` 同步到同一内容，并已 live apply 到 `lab-portal`。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 成功；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n lab-portal get configmap lab-portal-site -o yaml | rg 'LOAD_TEST.md|Portal Curated|Open live'` 已确认集群真源是新版本；由于当前 `lab-portal` Pod 没有自动热刷新新 ConfigMap，额外执行 `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n lab-portal rollout restart deployment/lab-portal && ... rollout status ... --timeout=180s` 后，再用 `curl --noproxy '*' -fsS http://192.168.0.108:30088` 已能回读到 `Load Test Guide`、`LOAD_TEST.md`、`Portal Curated 2026-03-21` 和新的 `Open live / 去看 live` 文案。
- 下一步：如果要继续把 Portal 做得更像“值班首页”，下一轮优先考虑把少量真正需要实时刷新的摘要改成从 Grafana/Prometheus/Argo 读取，而不是继续在 HTML 里手写状态文案。
- 阻塞/风险：虽然 Portal 当前已明确降级为“导航 + 文档 + live truth 入口”，但 `lab-portal` 这条 Nginx + ConfigMap 目录挂载路径在当前环境里仍没有做到真正热刷新；后续如果继续频繁改页面，默认仍应把 rollout restart 纳入发布动作，避免误以为 `configmap configured` 就代表用户已经看到新内容。

## 2026-03-21
- 完成：为 `lab-ha` 实验补齐最小压测能力。新增 `/Users/simon/projects/webapp-template/scripts/loadtest/lib/config.js`、`/Users/simon/projects/webapp-template/scripts/loadtest/lib/http.js`、`/Users/simon/projects/webapp-template/scripts/loadtest/lib/workflows.js`，统一收口 `BASE_URL`、`Host` 路由、`request_id` 前缀、JSON-RPC 调用与鉴权流程；同时新增 `/Users/simon/projects/webapp-template/scripts/loadtest/health.js`、`/Users/simon/projects/webapp-template/scripts/loadtest/system.js`、`/Users/simon/projects/webapp-template/scripts/loadtest/auth.js`、`/Users/simon/projects/webapp-template/scripts/loadtest/mixed.js` 与 `/Users/simon/projects/webapp-template/scripts/loadtest/run.sh`，让仓库可以直接用 `k6` 或 Docker fallback 跑健康检查、基础 JSON-RPC、登录/注册 + `auth.me` 和混合场景。期间顺手修正了两个现场问题：一是把 `/healthz` 的断言放宽为“只校验 200”，避免 live 入口对正文处理差异造成误报；二是 `run.sh` 在 Docker fallback 下改成仅当 dashboard 开启时才绑定端口，并兼容 macOS 自带 Bash 3.2。
- 验证：`bash -n /Users/simon/projects/webapp-template/scripts/loadtest/run.sh` 通过；`docker run --rm -v /Users/simon/projects/webapp-template:/workspace -w /workspace grafana/k6:latest inspect /workspace/scripts/loadtest/health.js`、`.../system.js`、`.../auth.js`、`.../mixed.js` 已通过语法检查；实际 smoke 已执行 `BASE_URL=http://192.168.0.108:32668 LOADTEST_RUN_ID=lt-smoke-health K6_WEB_DASHBOARD=false bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh health --vus 1 --duration 3s` 与 `... run.sh system --vus 1 --duration 3s`，两轮阈值均通过，结果已落到 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/loadtest/lt-smoke-health/` 和 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/loadtest/lt-smoke-system/`。
- 下一步：先继续用保守参数执行一轮 `mixed`，观察 Grafana、Loki 与 Jaeger 中是否能按 `request_id` 前缀稳定收口；如果要验证鉴权链路，再决定是用固定测试账号跑 `login`，还是接受 `register` 模式产生真实测试用户。
- 阻塞/风险：`auth` 与 `mixed` 默认走 `register` 模式，会创建真实用户，建议仅在开发环境、试验命名空间或独立数据库里使用；当前压测结果只导出到本地 artifacts，还没有自动沉淀到 Prometheus/Grafana 的长期趋势看板。

## 2026-03-21
- 完成：收口仓库的 `main/master` 分支漂移。已在 live GitLab 项目 `root/webapp-template-lab` 将默认分支切换为 `master`，补上 `master` 保护规则（Maintainer 可推送/合并，禁止 force push），并删除陈旧 `main` 保护规则与远端分支；同时把仓库内仍会把人带回旧分支口径的入口统一到 `master`，包括 `/Users/simon/projects/webapp-template/scripts/README.md`、`/Users/simon/projects/webapp-template/scripts/qa/db-guard.sh`、`/Users/simon/projects/webapp-template/scripts/qa/secrets.sh`、`/Users/simon/projects/webapp-template/scripts/qa/yamllint.sh` 中的 `QA_BASE_RANGE` 示例，以及 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/platform-portal.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-overview-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/grafana-lab-overview-dashboard.yaml` 中指向 GitLab 文档的 `blob/master` 链接与值班提示文案。为了避免 Portal 以后再次因 `subPath` 卡住旧页面，这次还把 `lab-portal` 的 ConfigMap 挂载改成目录挂载，并已 live apply 到集群。
- 验证：`git ls-remote --symref gitlab HEAD refs/heads/main refs/heads/master` 与 `git ls-remote --symref origin HEAD refs/heads/main refs/heads/master` 现都只返回 `refs/heads/master`；通过 GitLab API 复核后，项目仅剩 `master` 分支和对应保护规则；`bash -n /Users/simon/projects/webapp-template/scripts/qa/db-guard.sh && bash -n /Users/simon/projects/webapp-template/scripts/qa/secrets.sh && bash -n /Users/simon/projects/webapp-template/scripts/qa/yamllint.sh` 通过；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `.../grafana-lab-overview-dashboard.yaml` 已更新 live ConfigMap，`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n lab-portal rollout status deployment/lab-portal --timeout=120s` 成功；`curl --noproxy '*' -fsS http://192.168.0.108:30088 | rg 'blob/master'` 已确认 Portal 页面文档链接切到 `master`，监控侧 `lab-ha-grafana-ops-overview` ConfigMap 也已写入 `blob/master` 与新的 sampled trace 提示文案。
- 下一步：把这轮本地改动提交并推送到发布 remote，让 GitOps 真源、live 资源和本地工作区重新对齐；随后再把 `lab-platform` 的 Helm release ownership 漂移回收到 chart 真源，避免后续平台发布覆盖现场修复。
- 阻塞/风险：虽然 live 已经只剩 `master` 口径，但本地这批变更仍未提交推送；此外 `lab-platform` Helm release 与现场手工 apply 的 ownership 漂移仍未完全回收，后续若平台层重新覆盖，仍需按 chart 真源再做一次统一收口。

## 2026-03-20
- 完成：收口实验室 trace/log 联动的 live 漂移。将 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-app.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml` 及 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/` 下对应副本的 `targetRevision` 从 `main` 改到当前实际有新提交的 `master`，并在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/templates/deployment.yaml` 为 config Secret 增加 `checksum/config-secret`，避免 tracing/DSN 等配置更新后 Pod 继续跑旧进程。live 侧已直接 `kubectl apply` 更新 `Application/webapp-template-lab`，让 Argo CD 切回 `charts/webapp-template` 真源并同步到 `ceabe5e`；`Secret/webapp-template-config` 已恢复 `trace.jaeger.endpoint=jaeger.monitoring.svc.cluster.local:4318`、`ratio=0.1`，随后滚动重启 `Deployment/webapp-template`，新 Pod 启动日志回到 `mode=otlp-http`。
- 验证：`helm template webapp-template-lab /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-lab.yaml` 成功；`cd /Users/simon/projects/webapp-template/server && go test ./pkg/logger ./internal/server ./cmd/server` 通过；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get application -n argocd webapp-template-lab -o jsonpath='{.status.sync.status} {.status.health.status} {.status.sync.revision} {.spec.source.path} {.spec.source.targetRevision}'` 返回 `Synced Healthy ceabe5e15f56c5eefcd9460191485cbd10e53bef server/deploy/lab-ha/charts/webapp-template master`；`curl --noproxy '*' -fsS http://192.168.0.108:32668/readyz` 返回 `ready`；live 日志中 `trace-link-login-310`、`trace-link-login-318` 已出现 `trace_sampled:true` 与 `trace_link_id`，对应 Jaeger trace `40bdd8972512072010cdb28fbede4a98`、`bbb3ddc1a5739928021252ad2125f7ea` 可查到 `/jsonrpc.v1.Jsonrpc/PostJsonrpc` / `auth.login` span，说明 Grafana `View trace` 已回到“只对真实存在的 sampled trace 出链接”。
- 下一步：把 GitLab `main/master` 分支口径统一掉，并让 `lab-platform` 的 Helm 真源重新接管这些 `Application` 资源与文档链接，避免后续平台 release 或 portal/dashboard 继续引用陈旧 `main`。
- 阻塞/风险：当前 live 生效仍带两处现场收口痕迹。一是 `webapp-template-lab` Application 通过 `kubectl apply` 直接切到了 `master`，但 `lab-platform` 的 Helm release 因历史 ownership 冲突还没完全接管回来；二是业务镜像仍依赖三台节点本地导入同名 `ha-lab` tag，而不是正式 Harbor 发布 + GitOps 镜像升级，后续若节点镜像被 GC 或平台层按旧 release 覆盖，仍可能出现短暂漂移。

## 2026-03-20
- 完成：修正 Helm 模板编辑器配置的错误前提。将 `/Users/simon/projects/webapp-template/.vscode/settings.json` 中 chart `templates/*.yaml`、`*.tpl` 的语言关联从错误的 `helm-template` 改为 `helm`，并把 `/Users/simon/projects/webapp-template/.vscode/extensions.json` 的推荐扩展补全为 `ms-kubernetes-tools.vscode-kubernetes-tools + Tim-Koehler.helm-intellisense`，让语法模式与补全/lint 组合回到一致口径。
- 验证：本机已确认安装 `ms-kubernetes-tools.vscode-kubernetes-tools`；其 package.json 明确注册了 `helm` 语言，并内建 `**/templates/*.yaml|yml|tpl` filenamePatterns；`Tim-Koehler.helm-intellisense` 的运行时代码也确认对 `yaml` 与 `helm` 语言注册补全 provider，说明当前修正后的工作区配置与扩展实现一致。
- 下一步：在 VS Code 中执行一次 `Developer: Reload Window`，然后重新打开 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/templates/deployment.yaml`；若状态栏语言模式仍显示 `YAML`，手动切到 `Helm` 一次即可把缓存的旧语言模式纠正过来。
- 阻塞/风险：VS Code 对已打开编辑器可能沿用旧的语言模式缓存；即使仓库配置已经修正，如果窗口未 reload 或当前标签页未重新打开，仍可能暂时继续显示旧的 YAML 误报。

## 2026-03-20
- 完成：为实验室高频值班告警补齐本地排障入口。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/patch-alert-link-overrides.sh`，统一给 `TargetDown`、`KubeProxyDown`、`KubeSchedulerDown`、`KubeControllerManagerDown` 注入 `dashboard_url`、`runbook_url`、`alertmanager_url`，并把官方 `runbook_url` 迁到 `upstream_runbook_url` 保留兜底说明；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/OPS_CHECKLIST.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，把“告警 -> Grafana 总览 -> Runbook”的值班路径写成现场口径。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/patch-alert-link-overrides.sh`；执行脚本后，`curl --noproxy '*' -sS 'http://192.168.0.108:30090/api/v1/rules'` 已能看到 `TargetDown / KubeProxyDown / KubeSchedulerDown / KubeControllerManagerDown` 的 `dashboard_url`、`runbook_url`、`alertmanager_url`、`upstream_runbook_url`；`curl --noproxy '*' -sS 'http://192.168.0.108:30093/api/v2/alerts/groups'` 也已返回这些 firing 告警实例的新 annotations，说明 Alertmanager live 页面刷新后即可直接点链接。
- 下一步：如果后续还要继续提升值班效率，优先把同一套路补到少量真正常看、且与你这套实验环境强相关的告警上；不要一次性重写全部 kube-prometheus 默认规则，避免把维护面做大。
- 阻塞/风险：当前这些高频告警的链接是通过脚本 patch 到 live `PrometheusRule` 对象上的，短期值班体验已经到位，但它们还没回收到单一 Helm 真源；后续如果重新安装或升级 `kube-prometheus-stack`，需要把这组 override 正式收口回 chart values 或平台 chart，避免被上游规则覆盖。

## 2026-03-20
- 完成：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/CILIUM_HUBBLE_RUNBOOK.md`，把当前 `Cilium eBPF + Hubble + MetalLB L2` 口径下最常用、且已在 live 集群验证过的命令整理成一份独立运行/排障手册，覆盖 `KubeProxyReplacement` 快速确认、`NodePort/LoadBalancer` 的 BPF LB map 检查、endpoint/policy 排查、`cilium-dbg monitor` 实时看 drop 与 policy verdict，以及如何区分 `eBPF datapath` 问题和 `MetalLB L2 / 外部路由` 问题；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 索引。
- 下一步：如果后续你要继续做 `Cilium BGP` 或 native routing 实验，再在这份 runbook 上补“BGP peer 建立、路由通告与多集群互联”的独立章节，不要和当前 `eBPF` 排障步骤混在一起。
- 阻塞/风险：当前手册刻意只写现场已验证命令，没有引入额外 `hubble` CLI 安装步骤；因此实时流量观察仍以 `Hubble UI` 和 `cilium-dbg monitor` 为主，后续若你希望用命令行过滤 flow，再单独补 `hubble` CLI 的安装与使用口径。

## 2026-03-20
- 完成：为避免“看到部署真源约定就误以为 Compose 也要 Helm 化”的歧义，进一步更新 `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`、`/Users/simon/projects/webapp-template/AGENTS.md`、`/Users/simon/projects/webapp-template/server/deploy/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，明确写死 `server/deploy/compose/prod` 继续是单机/单宿主机的 Compose 主路径，不适用 `lab-ha` 的 Helm 规则。
- 验证：人工复核上述四处文案，确认“Compose 不需要 Helm 化”已经从推断变成显式规则；本次仅为文档澄清，无需额外渲染或集群校验。
- 下一步：后续若仍担心 AI 误读，可以再把 `server/deploy/compose/prod/README.md` 首页补一行“本路径与 `lab-ha` Helm 规则无关”的显式提示；目前仓库根级与部署索引级约定已经足够清楚。
- 阻塞/风险：当前 `compose/prod/README.md` 本身还没有单独重复这句限制语；虽然根级约定、AGENTS 和部署索引都已写明，但如果未来有人只打开 Compose README 而不看其他索引，仍有极小概率看不到这层背景。

## 2026-03-20
- 完成：新增项目级部署约定文档 `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`，把“什么时候必须用 Helm、什么时候保持 Kustomize、什么时候只允许裸 YAML 作为原始输入或临时对象、现场 patch 如何回收到真源”写成可执行规则；文档同时明确了 `server/deploy/dev|prod` 是模板骨架，而 `server/deploy/lab-ha` 是当前实验环境的 Helm 主路径，避免后续又回到多真源并存。
- 完成：更新 `/Users/simon/projects/webapp-template/AGENTS.md`，新增“部署真源约定”章节，把 `lab-ha` 第三方组件走 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`、平台自定义资源由 `charts/lab-platform` 接管、实验业务部署统一走 `charts/webapp-template`、部署路径变更必须同步 Argo/CD 文档/脚本 这些规则固化为后续 AI 的默认行为；同时更新 `/Users/simon/projects/webapp-template/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 入口索引，让新约定能被直接发现。
- 验证：人工复核 `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`、`/Users/simon/projects/webapp-template/AGENTS.md`、`/Users/simon/projects/webapp-template/server/deploy/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 的引用关系与路径表述，确认没有再把 `lab-ha` 的 live 主路径写回旧的 `argocd/webapp*` Kustomize 目录；本次为文档与协作约定更新，无需额外代码编译或集群 apply。
- 下一步：如果后续你要继续把这套约定推得更彻底，可以再做两件事：一是把 `argocd/webapp*` 旧目录明确标成“历史参考只读”，二是在 CI 或 pre-commit 里增加轻量守卫，阻止 `lab-ha` 再新增新的等价 Kustomize 主路径。
- 阻塞/风险：当前旧的 `server/deploy/lab-ha/argocd/webapp*` 目录仍保留在仓库里，主要为了历史对照和运行时 Secret 示例；虽然文档与 AGENTS 已明确 Helm 才是主路径，但如果后续有人只看目录结构不看约定，仍可能误以为这些目录可以继续作为 live 真源，因此后续最好再补一层只读标识或自动校验。

## 2026-03-20
- 完成：把实验室 `lab-ha` 目录收口成 Helm 真源。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 作为统一入口，固定了 `cilium / metallb / ingress-nginx / cert-manager / longhorn / cloudnative-pg / seaweedfs / kube-prometheus-stack / blackbox-exporter / sealed-secrets / velero / promtail / argo-cd / argo-rollouts / harbor` 的当前实验室 chart 版本，并补齐 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/` 下缺失的 values 文件；同时把 `ingress-nginx externalTrafficPolicy=Cluster` 这类原本只存在于现场 patch 的入口策略正式回收到 Helm values。
- 完成：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/`。其中 `lab-platform` 负责接管 Jaeger、Loki、Grafana datasource/dashboard、Portal、NodePort/Ingress、Argo 监控补充对象、Harbor UI proxy、SealedSecret 等平台级自定义资源，并把 MetalLB 当前 live 地址池 `primary-pool / primary-l2` 一并纳入 Helm；`webapp-template` 则把 `lab`、`prod-trial`、`prod-trial internal` 三种形态统一为单 chart + 多 values，避免实验目录继续并存 Kustomize/裸清单/手工 patch 三套路径。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-app.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml`，让 Argo CD 直接指向新的 Helm chart 与 values 文件；同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ha-lab-runbook.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/HANDOVER.md`、`/Users/simon/projects/webapp-template/server/deploy/README.md`，把高可用实验的部署入口改成统一 Helm 口径。
- 验证：`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh list`；`helm lint /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform`；`helm lint /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-lab.yaml`；`helm lint /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial.yaml`；`ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 已生成 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 已通过；`helm template webapp-template-lab /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-lab.yaml | kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f -` 与 `helm template webapp-template-prod-trial /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial.yaml -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial-internal.yaml | kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f -` 也已通过。
- 下一步：若后续要把这套 Helm 真源真正推到 live 集群，建议先按 `ONLY=<release>` 分批执行 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply`，优先验证 `ingress-nginx`、`kube-prometheus-stack`、`lab-platform` 和 `harbor` 这几个最容易受历史 drift 影响的 release；确认稳定后，再做一次全量 apply 收口现场偏差。
- 阻塞/风险：当前网络环境访问部分外部 Helm 仓库仍会出现 `EOF` 抖动，例如 `charts.longhorn.io`；因此脚本已保证“只渲染本地 `lab-platform`”时不再强制 repo update，但若执行全量 `template/apply`，仍可能受外部 chart 源可达性影响，需要重试或切内网镜像源/仓库镜像。另一个保守取舍是：`argocd/webapp*` 旧 Kustomize 目录目前保留为历史参考，但 Helm 已经是主路径，后续若继续演进业务部署，应优先改 chart 和 values，不要再把新变更写回旧目录。

## 2026-03-20
- 完成：把实验室 `LabEndpointDown` 告警收口成“告警 -> Dashboard -> Runbook”的最小值班链路。仓库侧已更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/blackbox-values.yaml`，为 blackbox 告警补齐 `dashboard_url`、`runbook_url`、`alertmanager_url` 三个 annotations，并把文案改成带 `target` 的明确摘要；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/alertmanager-values.yaml`，让 Alertmanager 路由按 `target` 参与分组，避免多个入口异常被聚成一团。
- 完成：同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/OPS_CHECKLIST.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`，明确值班时先看 Alertmanager，再点 `dashboard_url` 和 `runbook_url`，把实验室入口类告警的处理顺序写成固定口径。
- 完成：已对 live 集群执行两项受控 patch。其一是 patch `PrometheusRule/blackbox-exporter-prometheus-blackbox-exporter`，让当前运行中的 `LabEndpointDown` 规则立刻带上 `dashboard_url/runbook_url/alertmanager_url`；其二是 patch `Secret/alertmanager-kube-prometheus-stack-alertmanager`，把 Alertmanager 当前生效配置里的 `route.group_by` 补上 `target`，随后确认 generated secret 已同步到相同配置。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring get prometheusrule blackbox-exporter-prometheus-blackbox-exporter -o yaml`；`curl --noproxy '*' 'http://192.168.0.108:30090/api/v1/rules'` 已看到 live `LabEndpointDown` annotations 带上三类链接；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring get secret alertmanager-kube-prometheus-stack-alertmanager -o jsonpath='{.data.alertmanager\\.yaml}' | base64 -d` 与 generated secret 解压后内容均已包含 `group_by: [namespace, alertname, severity, target]`；另外通过临时 `PrometheusRule/lab-alert-links-smoke` 做过一次 smoke，`Alertmanager API /api/v2/alerts/groups` 已返回含 `dashboard_url` 与 `runbook_url` 的活动告警，随后已删除该临时规则，不留现场噪音。
- 下一步：若后续要把这套告警联动迁到其他项目，优先照搬“告警 annotations 直接给 dashboard/runbook 链接 + Alertmanager 按 target 分组”这一组做法；再往上走时，才考虑把这些链接继续收口到更正式的通知模板或外部 IM 卡片。
- 阻塞/风险：当前 live Alertmanager 分组调整是通过 patch 基础 secret 落地的，功能上已经生效，但长期仍应以 Helm 真源回收，避免后续 chart 升级把这类现场 patch 覆盖掉；另外 `LabEndpointDown` 当前只对实验室 blackbox 入口生效，其他 kube-prometheus 默认规则仍主要使用官方 `runbook_url`，还没有统一切到本仓库自己的值班文档。

## 2026-03-20
- 完成：修正 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/webapp-template-lab.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp/webapp-template-lab.yaml` 中 `NetworkPolicy` 片段误残留的重复 `ingress/egress` 键，避免 `yamllint key-duplicates` 在提交阶段拦截；当前两份清单都只保留一组 `Ingress + Egress` 规则，并继续包含放行 `monitoring:4318/TCP` 的 tracing egress。
- 完成：补齐 Jaeger 的 blackbox live 探测与值班看板收口。由于当前本机访问 `prometheus-community` chart 源仍有 `EOF / SSL_ERROR_SYSCALL` 抖动，未继续硬做 Helm 在线升级，而是新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/blackbox-jaeger-servicemonitor.yaml`，以与现有 `blackbox-exporter` release 相同的命名和 ownership 元数据，为 `http://192.168.0.108:30686/` 补了一个 Jaeger blackbox `ServiceMonitor`；同时把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-overview-dashboard.yaml` 的顶部 blackbox 指标改成专门展示 `Jaeger Probe`。
- 完成：已把新的 Jaeger blackbox 探测对象 apply 到 live 集群，并在 Prometheus reload 漂移后重启一次 `prometheus-kube-prometheus-stack-prometheus-0`，让运行态 targets 与已生成 scrape config 对齐；当前 `probe_success{target="jaeger"}` 已进入实际采集结果，Grafana 总览面板也已切到 Jaeger 专项探测查询。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/blackbox-jaeger-servicemonitor.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring describe servicemonitor blackbox-exporter-prometheus-blackbox-exporter-jaeger`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring delete pod prometheus-kube-prometheus-stack-prometheus-0 && kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring wait --for=condition=Ready pod/prometheus-kube-prometheus-stack-prometheus-0 --timeout=240s`；`curl --noproxy '*' -sS 'http://192.168.0.108:30090/api/v1/query?query=max%20by%20(target)(probe_success%7Bjob%3D%22blackbox-exporter-prometheus-blackbox-exporter%22%7D)'` 当前已返回 `jaeger=1`；`curl --noproxy '*' -sS 'http://192.168.0.108:30090/api/v1/query?query=probe_success%7Bjob%3D%22blackbox-exporter-prometheus-blackbox-exporter%22%2Ctarget%3D%22jaeger%22%7D'` 已返回单条 `value=1`；`curl --noproxy '*' -su 'admin:Grafana123!' 'http://192.168.0.108:30081/api/dashboards/uid/lab-ha-overview' | jq -r '.dashboard.panels[] | select(.title=="Jaeger Probe") | .targets[0].expr'` 已确认总览面板查询为 `max(probe_success{job="blackbox-exporter-prometheus-blackbox-exporter",target="jaeger"})`。
- 下一步：等后续 Helm chart 源恢复稳定后，可以把这份桥接 `ServiceMonitor` 回收进 `blackbox-exporter` release 的正式 values 升级流程，减少黑盒目标既在 `blackbox-values.yaml`、又在桥接清单里各保一份的维护成本；在那之前，这个桥接对象已经能稳定支撑 Jaeger 值班探测和告警。
- 阻塞/风险：当前 Jaeger blackbox live 探测依赖桥接 `ServiceMonitor`，而不是直接由 Helm release 渲染出来；功能上已闭环，但从长期维护角度看，这仍然是为了绕过外部 chart 源不稳定做的保守兜底，后续 Helm 真源恢复后应优先收敛回单一来源。

## 2026-03-20
- 完成：为实验室观测栈补齐 Grafana 内的日志/追踪联动，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-jaeger-datasource.yaml`，把 `Jaeger` 正式注册成 Grafana datasource，并配置 `tracesToLogsV2` 按 trace id 回查 Loki；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-loki-datasource.yaml`，为日志里的 `trace.id` / `trace_id` 增加直接跳转 Jaeger 的 derived field，减少值班时手工复制 trace id。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-overview-dashboard.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-data-services-dashboard.yaml`，把日常排障口径明确收口为 `Loki -> trace.id -> Jaeger -> Logs for this span`；同步补充 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，说明 Grafana 已具备日志到 trace、trace 回日志的联动能力。
- 完成：已在真实集群 apply 上述 ConfigMap，并对 `kube-prometheus-stack-grafana` 执行滚动重启，让 provisioning datasource 进入 live 运行态；当前 Grafana API 已能看到 `uid=jaeger` 的 datasource，以及 Loki datasource 下的 `trace.id` / `trace_id` derived fields。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-loki-datasource.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-jaeger-datasource.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring rollout restart deployment/kube-prometheus-stack-grafana && kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring rollout status deployment/kube-prometheus-stack-grafana --timeout=240s`；`curl --noproxy '*' -su 'admin:Grafana123!' 'http://192.168.0.108:30081/api/datasources' | jq '.[] | select(.uid=="jaeger") | .jsonData.tracesToLogsV2'`；`curl --noproxy '*' -su 'admin:Grafana123!' 'http://192.168.0.108:30081/api/dashboards/uid/lab-ha-overview' | jq -r '.dashboard.panels[] | select(.title=="Quick Links") | .options.content'`；`curl --noproxy '*' -su 'admin:Grafana123!' 'http://192.168.0.108:30081/api/dashboards/uid/lab-ha-data' | jq -r '.dashboard.panels[] | select(.title=="Data Plane Notes") | .options.content'` 均已返回预期结果。
- 下一步：若后续要把这套联动迁到其他项目，优先复用“Loki derived fields + Grafana Jaeger datasource + trace id 回 Loki 自定义查询”这一组最小配置；若需要更强的 trace 到日志精准回查，再考虑在应用 span 里补稳定的 `k8s.namespace` / `pod` 资源属性，而不是现在就引入更重的 service mesh 或全链路治理平台。
- 阻塞/风险：当前 `trace -> logs` 回查依赖日志正文里确实出现 trace id；对只产 trace、不打成功日志的链路，Grafana 仍可能出现“能点回日志，但时间窗内没有匹配日志”的情况。这是当前模板为了控制健康检查与静态路由日志噪声做的取舍，不是 Jaeger / Grafana 配置失效。

## 2026-03-20
- 完成：为 `webapp-template` 的实验室基线补齐 Jaeger v2 tracing，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/jaeger.yaml`，采用单实例 + 内存存储 + OTLP HTTP/GRPC 接收 + Prometheus `ServiceMonitor` 的轻量模式，并通过 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-nodeports.yaml` 暴露 `Jaeger UI` 直连入口 `192.168.0.108:30686`；同时补充 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-ingresses.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md`，把 tracing 入口、内存存储边界和 NetworkPolicy 关键约束写清楚。
- 完成：修复 `/Users/simon/projects/webapp-template/server/cmd/server/main.go` 中 tracing `ratio` 配置“有字段但不生效”的问题，新增采样率归一化和 `ParentBased(TraceIDRatioBased)` 采样器，并用结构化日志替代原来的 `fmt.Println` 启动输出；同时新增 `/Users/simon/projects/webapp-template/server/cmd/server/main_test.go`，覆盖采样率归一化和父采样决策回归测试。
- 完成：把 `webapp-prod-trial` 接到 Jaeger，并补齐 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-tracing.sh` 用于“触发请求 -> 校验 Jaeger 中出现 `webapp-template.service`”；在真实集群里还排掉了一个容易漏的坑：`webapp-prod-trial` 的 `NetworkPolicy` 原本只放行 PostgreSQL 与 DNS，导致应用向 `jaeger.monitoring.svc.cluster.local:4318` 持续超时，现已在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial/webapp-template.yaml` 放行 `monitoring` 命名空间 `4318/TCP`，并同步把 `lab` 版清单也补齐到相同口径。
- 完成：考虑到节点对 DockerHub 拉取 Jaeger 不稳定、而本机 Docker 默认把 Harbor 当 HTTPS，本次没有再硬拗仓库推送链路，而是把 `jaegertracing/jaeger:2.14.1` 的 `amd64` 镜像和新的 `webapp-template-server:20260320T085934-521371ba-local` / `:ha-lab` 直接导入三台节点的 `containerd`，保证 `webapp-prod-trial` 和 Jaeger 都能在当前三台实验 VM 上稳定滚起来；`webapp-prod-trial` 现已滚到新镜像，两副本分别跑在 `node2/node3`，Jaeger 现已健康运行在 `monitoring` 命名空间。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./cmd/server ./internal/server ./internal/data`；`docker run --rm -v /tmp/jaeger-v2-config.yaml:/etc/jaeger/config.yaml:ro jaegertracing/jaeger:2.14.1 validate --config=file:/etc/jaeger/config.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/jaeger.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring rollout status deployment/jaeger`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial rollout status deployment/webapp-template-prod-trial`；`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-tracing.sh`；`curl --noproxy '*' http://192.168.0.108:30686/api/services` 已返回 `["jaeger","webapp-template.service"]`，`curl --noproxy '*' 'http://192.168.0.108:30686/api/traces?service=webapp-template.service&limit=3'` 已拿到 `server.http.readyz/healthz` spans；`curl --noproxy '*' 'http://192.168.0.108:30090/api/v1/query?query=up%7Bservice%3D%22jaeger%22%7D'` 已看到新 Jaeger target 为 `1`。
- 下一步：如果后续要把这套 tracing 基线迁到其他项目，优先复用“Jaeger v2 单实例 + 应用显式 `trace_ratio` + 内网 `NetworkPolicy` 放行 `monitoring:4318` + 巡检脚本”这套最小闭环；若要继续提高观测性完整度，再补日志侧按 `trace_id` 的检索入口和黑盒对 `Jaeger UI` 的 live 探测。
- 阻塞/风险：当前 Jaeger 仍是单实例 + 内存存储，重启或滚动升级会丢历史 trace，只适合实验室与生产试验排障，不是持久化 tracing 真源；`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/blackbox-values.yaml` 已更新 Jaeger 探测目标，但 live 集群的 `blackbox-exporter` Helm release 这次没有重新升级，因为本机访问 Helm 仓库存在 SSL/仓库源问题；另外 `server/Makefile` 仍把 `DOCKER_HOST` 当镜像前缀变量使用，和 Docker CLI 的守护进程环境变量重名，后续若继续用 `make push_server` 推 Harbor，建议优先改成显式 `IMAGE_NAME` 或单独重命名变量，避免再次把请求误发到 Harbor API。

## 2026-03-20
- 完成：将 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/cilium-values.yaml` 的 `kubeProxyReplacement` 从 `false` 切换为 `true`，并为 API VIP 与 eBPF Service datapath 收口补充关键注释；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，明确当前目标口径是 `Cilium eBPF` 负责 `ClusterIP / NodePort / LoadBalancer`，而 `BGP` 仍作为后续独立演进项。
- 完成：已对 live 集群执行 `SKIP_REPO_UPDATE=1 ONLY=cilium bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply`，随后手动滚动 `ds/cilium` 与 `deploy/cilium-operator`，使 `cilium-dbg status --verbose` 明确进入 `KubeProxyReplacement=True`，并显示 `ClusterIP / NodePort / LoadBalancer / externalIPs / HostPort` 全部由 Cilium 接管。
- 完成：已将现有 `kube-proxy` DaemonSet 与 ConfigMap 备份到 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/rollback/kube-proxy-daemonset.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/rollback/kube-proxy-configmap.yaml` 后删除 live `kube-proxy` DaemonSet；删除后再次验证三台节点 `:32668`、`MetalLB VIP 192.168.0.120/readyz` 与 `Hubble UI :30085` 均保持正常。
- 验证：`SKIP_REPO_UPDATE=1 ONLY=cilium bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 已渲染出 `kube-proxy-replacement: "true"`；`helm --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system get values cilium -a` 已确认 `kubeProxyReplacement: true` 且 `bgpControlPlane.enabled: false`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system exec ds/cilium -- cilium-dbg status --verbose` 已显示 `KubeProxyReplacement: True` 和 `NodePort/LoadBalancer/externalIPs/HostPort Enabled`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system get pods -o wide | rg 'cilium|kube-proxy'` 已确认 `kube-proxy` 不再运行；`for ip in 192.168.0.7 192.168.0.108 192.168.0.128; do curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' http://$ip:32668/readyz; done`、`curl --noproxy '*' http://192.168.0.120/readyz`、`curl --noproxy '*' http://192.168.0.108:30085/` 均通过。
- 下一步：如果后续要继续做“路由收敛 / 跨子网直达 / 多集群互联”实验，再单独评估是否开启 `Cilium BGP Control Plane`、是否从当前 `vxlan` 转向 native routing，以及是否继续引入 `Cluster Mesh`。
- 阻塞/风险：当前 `Cilium eBPF` 已接管 Service datapath，但 live 集群仍使用 `vxlan + MetalLB L2`，而 `bgpControlPlane.enabled` 仍为 `false`；因此这次收口解决的是 Service 转发与网络观测性，不等于已经解决跨子网客户端、外部路由发布或多集群路由收敛问题。

## 2026-03-20
- 完成：把 `webapp-prod-trial` 当前阶段的正式入口口径收口为“内部域名 `webapp-trial.lab.home.arpa` + 多节点 NodePort + `externalTrafficPolicy=Cluster`”。已直接对集群执行 `kubectl patch svc ingress-nginx-controller -n ingress-nginx --type merge -p '{"spec":{"externalTrafficPolicy":"Cluster"}}'`，让 `192.168.0.7 / 108 / 128:32668` 都能在任意节点本地没有 ingress pod 时继续转发流量。
- 完成：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ensure-ingress-nodeport-cluster.sh`，分别用于检查三台节点对内部域名 Host 路由的健康情况，以及在入口策略漂移时重新把 `ingress-nginx-controller` 收口到 `externalTrafficPolicy=Cluster`。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/INTERNAL_DNS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`，明确当前推荐访问方式不再是单节点 `192.168.0.108:32668`，而是 `webapp-trial.lab.home.arpa` 配合 `192.168.0.7 / 108 / 128` 多节点 A 记录统一走 `:32668`；同时补齐“VIP 不通但 NodePort 可用”的排障口径。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n ingress-nginx get svc ingress-nginx-controller -o wide`；`for ip in 192.168.0.7 192.168.0.108 192.168.0.128; do curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' http://$ip:32668/readyz; done`；删除 `node2` 上的一个 `ingress-nginx-controller` Pod 后，三台节点的 `:32668` 连续 5 轮都保持 `200`；从节点网络探测 `192.168.0.120/readyz` 返回 `200`，说明应用层和 ingress 层 HA 都已成立；`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh`、`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ensure-ingress-nodeport-cluster.sh`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/data ./cmd/server ./internal/server`、pre-commit 内的 `shellcheck` / `go vet` / `golangci-lint` 均已通过。
- 下一步：如果后续要把内部域名从 `:32668` 继续收口成标准 `80/443`，再单独处理 VPN / 子网路由与 `MetalLB L2 VIP` 的兼容性；在那之前，这套“内部域名 + 多节点 NodePort”就是当前生产试验的正式入口。
- 阻塞/风险：`externalTrafficPolicy=Cluster` 是当前 live 集群上的入口收口动作，但 `ingress-nginx` 的 Helm 真源还不在本仓库里，后续若重装或升级 ingress，需要重新执行 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ensure-ingress-nodeport-cluster.sh`；另外 `argocd-webapp-prod-trial-app-internal.yaml` 仍只是本地准备态，未推送到远端 Git 仓库前不能直接在集群里启用，否则 Argo 会因为远端缺少新 path 报 `ComparisonError`。

## 2026-03-20
- 完成：继续排查 `webapp-prod-trial` 的内部域名入口，确认当前 `192.168.0.120` 不是节点 IP，而是 `MetalLB` 分配给 `ingress-nginx-controller` 的 VIP；同时定位到当前管理机访问 `192.168.0.0/24` 走的是 `utun4` 路由链路，不在与集群相同的二层广播域内，因此会出现“节点 IP 可达、L2 VIP 不可达”的现象。
- 完成：补充 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/INTERNAL_DNS.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md`，明确 `192.168.0.120` 的 VIP 语义、`MetalLB L2` 对客户端网络位置的边界条件，以及“跨 VPN / 子网路由客户端优先用 `node2/node3 + NodePort` 验证 Host 路由”的保守做法。
- 验证：`route -n get 192.168.0.120` 显示当前管理机通过 `utun4` 访问该网段；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n ingress-nginx get svc ingress-nginx-controller -o wide` 确认 `EXTERNAL-IP=192.168.0.120`；从 `metallb-speaker` 所在主机网络执行 `wget -S -O - http://192.168.0.120/readyz` 返回 `200 ready`，而当前管理机直连 `http://192.168.0.120/readyz` 超时；删除一个 `ingress-nginx-controller` 副本后，`192.168.0.128:32668` 仍持续返回 `200`。
- 下一步：若后续要把内部域名真正收口到不带端口的标准入口，需要继续排虚拟化网络 / VPN 子网路由与 `MetalLB L2` 的兼容性；若当前目标只是稳妥推进生产试验，则继续沿用 `node2/node3 + NodePort` 做内部域名验证更稳。
- 阻塞/风险：当前 `MetalLB` 的 L2 VIP 对“跨 VPN / 子网路由客户端”不可直接作为标准入口使用；这不是应用层单点问题，但会影响“内部域名直连 80/443”这一体验目标。

## 2026-03-20
- 完成：调整 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 的默认账号复制交互，保留页面上的 `账号 / 密码` 展示，但把每个复制按钮的 `data-copy` 改为“只复制密码”；同时把按钮默认文案改成中英文一致的“复制密码 / Copy password”，并补一个最小样式约束避免英文长文案导致按钮抖动。
- 完成：已将更新后的 Portal 清单 apply 到 `lab-portal` 命名空间，并对 `deployment/lab-portal` 执行 `rollout restart`，确保通过 `subPath` 挂载的 `index.html` 立即刷新到线上 `http://192.168.0.108:30088/`。
- 验证：`rg -n 'data-copy=|copy.default|copy.fallback|copy.success|只复制密码|账号 / 密码' /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`；`kubectl apply --dry-run=client -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n lab-portal rollout status deployment/lab-portal --timeout=120s`；`curl -fsS http://192.168.0.108:30088/ | rg -n 'Copy password|data-copy=\"AdminLab123!\"|data-copy=\"HarborAdmin123!\"|copy.default|复制密码|Manual copy|手动复制'`
- 下一步：如果后续还想进一步收紧误操作，可以继续把默认账号区拆成“用户名可见 + 密码单独可复制”的双列展示，减少用户把整行文本误当成复制内容的心理预期。
- 阻塞/风险：当前 Portal 仍是静态页，默认账号与密码继续硬编码在清单里；本次只收紧复制行为，没有改变凭据来源与展示方式。

## 2026-03-20
- 完成：更新 `/Users/simon/projects/webapp-template/AGENTS.md` 的 Git 推送约定，明确当前仓库默认发布 remote 为 `origin` 与 `gitlab`，默认顺序为“先 `origin`、后 `gitlab`”，并约定不能只跟随 upstream 推送单个 remote。
- 完成：补充多 remote 失败处理口径：若 `gitlab` 因本地服务离线或网络异常不可用，不阻断对 `origin` 的成功推送，也不做回滚，而是按“部分成功”汇报，并在结果中逐一说明各 remote 状态。
- 验证：人工复核 `/Users/simon/projects/webapp-template/AGENTS.md` 新增条目，确认已覆盖“默认发布 remote”“推送顺序”“单 remote 失败不阻断后续 remote”“用户显式指定 remote 时严格遵循”四类协作边界。
- 下一步：后续若仓库新增新的长期发布 remote，应先更新 `/Users/simon/projects/webapp-template/AGENTS.md` 的发布 remote 列表，再调整默认推送行为，避免把临时 fork 或上游模板 remote 误当成发布目标。
- 阻塞/风险：当前规则是项目级约定，不会自动修改本地 Git upstream；若后续工具仍只按 upstream 推送，仍需要以 `AGENTS.md` 为准显式覆盖。

## 2026-03-20
- 完成：为 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 的实验室 Portal 补齐轻量中英文切换，保持纯静态实现：页头新增 `中文 / EN` 语言开关，文案统一收口到原生 `translations` 表，默认优先读取 `localStorage`，没有持久化选择时按浏览器语言回退；同时把复制按钮反馈也切到当前语言，并保留剪贴板权限失败时的人工复制兜底提示。
- 完成：已将更新后的 Portal 清单应用到 `lab-portal` 命名空间，并对 `deployment/lab-portal` 执行 `rollout restart`，确保通过 `subPath` 挂载的 `index.html` 立即刷新到线上 `http://192.168.0.108:30088/`。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=client -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n lab-portal rollout status deployment/lab-portal --timeout=120s`；`curl -fsS http://192.168.0.108:30088/ | rg -n "lang-switch|labPortalLanguage|切换语言|Portal 的用途|Switch language"`；Playwright 实测 `?v=20260320-lang` 下中文/英文切换、生效持久化、页面标题/文案联动，以及复制按钮在剪贴板失败后的多语言兜底提示和自动恢复。
- 下一步：如果后续确认 Portal 会长期承担交接和值班入口，可再把快照卡片中的时间戳与状态从静态文案抽成生成式配置，避免双语文本和运行态信息长期手工维护。
- 阻塞/风险：当前双语仍是手写字典，后续若新增 Portal 卡片或说明文案，需要同步补 `zh/en` 两份键值；另外 Playwright 环境下浏览器剪贴板权限受限，所以自动化校验命中了“请手动复制 / Copy manually”兜底分支，真实浏览器在授权后仍会返回正常“已复制 / Copied”提示。

## 2026-03-20
- 完成：为 `webapp-prod-trial` 新增独立的内部域名 overlay，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial-internal/kustomization.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial-internal/ingress-host-patch.yaml`，把内部域名切换从当前已跑通的 `prod-trial` 主线中拆出来；内部命名不再依赖你的公网主域名，默认统一采用保留域名 `*.lab.home.arpa`，业务入口定为 `webapp-trial.lab.home.arpa`。为降低切换风险，internal overlay 默认采用“双 Host 过渡”：保留当前 `webapp-trial.192.168.0.108.nip.io`，同时额外增加内部域名 Host。
- 完成：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml`，用于把现有 `webapp-template-prod-trial` Argo Application 的 `source.path` 切到 internal overlay，而不是新建第二个应用；同时新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/INTERNAL_DNS.md`，把“内部域名不需要 Cloudflare 公网解析”“优先内网 DNS / `hosts`”“当前 Ingress 对内入口是 `192.168.0.120`”“Argo CD 不要双 Application 管同一命名空间”这些容易踩坑的点收成可执行说明，并同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`。
- 验证：已执行 `kubectl kustomize /Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial-internal`，确认 overlay 能完整展开，Ingress 同时包含 `webapp-trial.192.168.0.108.nip.io` 与占位内部域名；已执行 `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml`，确认 Argo Application 切换清单语法可被集群侧 CRD 接受。本次未把 internal overlay apply 到集群，避免在你尚未给出真实内部域名之前误切现网入口。
- 下一步：给出真实内部域名后，先在本机 `hosts` 或内网 DNS 把该域名指向 `192.168.0.120`，再 apply `webapp-prod-trial-internal` overlay 做一次受控切换与验证。
- 阻塞/风险：当前 internal overlay 默认使用 `webapp-trial.lab.home.arpa`，需要你的内网 DNS 或本机 `hosts` 把它解析到 `192.168.0.120` 后才有意义；若后续准备用 Argo CD 接管内部域名版本，应修改现有 `webapp-template-prod-trial` 的 `source.path`，而不是新建第二个 Application 指向同一命名空间。

## 2026-03-20
- 完成：修复 `/Users/simon/projects/webapp-template/server/internal/data/admin_user_init.go` 的管理员初始化并发问题，把原来的“先查后插”改成 `INSERT ... ON CONFLICT DO NOTHING`，避免多副本并发启动时因 `admin_users.username` 唯一键冲突导致 Pod 启动直接 panic；同时新增 `/Users/simon/projects/webapp-template/server/internal/data/admin_user_init_test.go`，补齐“首次创建 / 已存在跳过 / 凭据缺失跳过”三条回归用例。
- 完成：为 `/Users/simon/projects/webapp-template/server/Dockerfile` 与 `/Users/simon/projects/webapp-template/server/Makefile` 增加基础镜像可覆盖参数（`NODE_BUILDER_IMAGE`、`GO_BUILDER_IMAGE`、`RUNTIME_BASE_IMAGE`），解决当前环境直连 `docker.io` 证书链异常导致的构建失败；随后构建并推送试验镜像 `harbor.192.168.0.108.nip.io:32668/library/webapp-template-server:20260319T235639-admin-init-fix`，并把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial/webapp-template.yaml` 切到该不可变 tag。
- 完成：在 `ha-lab` 集群把 `webapp-prod-trial` 滚动到新镜像，并通过 `/readyz`、滚动更新、删 Pod 自愈三轮试验验证运行稳定；期间发现 `ResourceQuota` 的 CPU/内存上限与 `pods: 4` 不一致，会在 rollout 时制造配额临界噪音，于是把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial/webapp-governance.yaml` 调整为 `limits.cpu=2000m`、`limits.memory=3Gi`，随后再次 `rollout restart`，未再出现新的 `FailedCreate`。
- 完成：按“删命名空间 -> 仅靠仓库清单恢复”的口径做了一次完整恢复演练：删除 `webapp-prod-trial` 命名空间后，入口按预期跌到 `503`；随后仅通过 `kubectl apply -k /Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial` 恢复，`SealedSecret` 重新解封、Deployment 恢复到 `2/2`，从重新 apply 到恢复完成约 `46s`，`trialadmin` 在 `webapp_template.admin_users` 中仍保持单条记录。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./internal/data ./cmd/server ./internal/server`；`kubectl kustomize /Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -k /Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial rollout status deployment/webapp-template-prod-trial`；`curl --noproxy '*' -H 'Host: webapp-trial.192.168.0.108.nip.io' http://192.168.0.108:32668/readyz`（多次返回 `200 ready`，删除命名空间期间按预期返回过 `503`）；删 Pod 期间入口持续可用，新镜像 Pod 日志稳定落在 `admin already exists, skip create` 幂等分支。
- 下一步：若要继续把这套试验口径往“可对外承接业务”推进，优先补域名/TLS、把运行时 Secret 改成更正式的密钥交付方式（例如 SealedSecret 收口流程文档化），并为 `prod-trial` 增加一次完整恢复演练（数据库 + 对象/配置恢复）。
- 阻塞/风险：当前生产试验仍然共享实验数据库 `webapp_template`，只是通过独立管理员账户与独立 JWT 密钥隔离运行态；这适合验证部署与恢复链路，不适合长期作为严格隔离的正式生产库。镜像构建也仍依赖当前环境可访问 `docker.m.daocloud.io`，后续若要交给 CI，最好把基础镜像源配置进一步标准化。

## 2026-03-19
- 完成：按值班落地思路补齐三份运维文档，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/OPS_CHECKLIST.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md`，把这套实验室环境的日常巡检、故障定位和恢复演练流程写成可直接执行的手册；同时把 Portal 文档区补上这些文档的 GitLab 直达链接，方便值班时直接点开。
- 验证：新增文档已经落在 `server/deploy/lab-ha/docs/`；Portal 配置已更新到包含 `OPS_CHECKLIST.md`、`TROUBLESHOOTING.md`、`RECOVERY_RUNBOOK.md` 三个链接；整个工作区当前只有文档相关改动，没有引入新的运行态变更风险。
- 下一步：若后续继续演进到多人运维阶段，可再把这些文档抽成更标准的值班制度，比如“日班/夜班交接模板”和“故障复盘模板”；当前版本已经足够让后续 AI 或人工按文档接手。
- 阻塞/风险：这些手册是基于当前实验室拓扑和口径编写的，默认入口仍是 `192.168.0.108:port`；如果后续访问口径或组件布局变化，需同步更新文档，避免文档与现场漂移。

## 2026-03-19
- 完成：为 `webapp-template` 补了一套独立于现有 `lab` 应用的低风险生产试验基线，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial/` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app.yaml`，让试验应用默认走单独命名空间 `webapp-prod-trial`、手动 Argo CD 同步、保守 `RollingUpdate(maxUnavailable=0,maxSurge=1)`、固定资源配额与独立 Ingress host；同时新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md`，把容量预检、Secret 准备、上线、回滚和验收步骤写成 runbook。
- 完成：同步在 `/Users/simon/projects/webapp-template/server/cmd/server/main.go` 增加 `WEBAPP_JWT_SECRET`、`WEBAPP_ADMIN_USERNAME`、`WEBAPP_ADMIN_PASSWORD` 运行时覆盖入口，配合已有 `POSTGRES_DSN` / `TRACE_ENDPOINT`，让生产试验不再需要把 JWT 密钥和管理员凭据继续硬编码进 Git 清单；关键逻辑只记录“来自环境变量覆盖”，避免把敏感值打进日志。
- 验证：已执行 `gofmt -w /Users/simon/projects/webapp-template/server/cmd/server/main.go`、`cd /Users/simon/projects/webapp-template/server && go test ./cmd/server ./internal/server`、`kubectl kustomize /Users/simon/projects/webapp-template/server/deploy/lab-ha/argocd/webapp-prod-trial`，当前启动入口相关包测试通过，新 `prod-trial` Kustomize 清单可完整展开。
- 下一步：先按 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md` 在集群里创建运行时 Secret、替换试验域名并手动同步 `webapp-template-prod-trial`；待单项目生产试验稳定后，再把同一套“Secret 注入 + 独立命名空间 + 手动同步 + 资源配额”模式迁移到其他项目。
- 阻塞/风险：当前仓库工作区本身已存在与本次无关的未提交改动和未跟踪文档（例如 `platform-portal.yaml`、`OPS_CHECKLIST.md`、`TROUBLESHOOTING.md`、`RECOVERY_RUNBOOK.md`），本次未触碰；另外生产试验仍是虚拟机上的软件层高可用，且 `SeaweedFS` / `Velero` / 域名 TLS / 真正恢复演练仍需按 runbook 逐步补齐后，才适合承接真实外部流量。

## 2026-03-19
- 完成：继续补齐交付链路的值班面，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-rollouts-metrics.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-gitops-dashboard.yaml`，让 Prometheus 开始抓取 `Argo CD server`、`Argo CD application controller` 与 `Argo Rollouts` 指标，并在 Grafana 新增 `HA Lab / GitOps & Delivery` 看板；同时把 Portal 再补一张 `GitOps & Delivery` 卡片。
- 验证：Prometheus 已能查询到 `argocd_app_info`、`argocd_app_sync_total`、`argocd_cluster_connection_status`、`argo_rollouts_controller_info` 等关键指标；Grafana 搜索已出现 `HA Lab / GitOps & Delivery`，地址 `http://192.168.0.108:30081/d/lab-ha-gitops/ha-lab-gitops-and-delivery` 返回 `200`；Portal 页面也已出现新的交付看板入口。
- 下一步：若后续要继续逼近正式值班体系，可再考虑给 Harbor 和 Longhorn 补更细的专项看板；当前总览 + 数据存储 + PostgreSQL 备份 + GitOps 交付四张看板，已经形成一套完整的实验室值班面板体系。
- 阻塞/风险：当前 Harbor 仍主要依靠 blackbox 与 deployment 可用副本作为运维信号，没有单独补更重的业务 exporter；这仍是基于实验室资源预算做的克制选择。

## 2026-03-19
- 完成：继续把 Grafana 看板拆得更适合值班使用，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/cnpg-podmonitor.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-postgres-backup-dashboard.yaml`，让 `CloudNativePG` 的实例角色、复制 lag、数据库大小、提交速率和 Velero 备份信号都能在单独的 PostgreSQL 看板里观察；同时把 Portal 再补一张 `PostgreSQL & Backup` 入口卡片。
- 验证：Prometheus 已出现 `database/app-pg-lab` 目标，`cnpg_collector_up`、`cnpg_pg_replication_in_recovery`、`cnpg_pg_replication_lag`、`cnpg_pg_database_size_bytes`、`velero_backup_last_status` 等指标均可查询；Grafana 新看板地址 `http://192.168.0.108:30081/d/lab-ha-postgres/ha-lab-postgresql-and-backup` 返回 `200`。
- 下一步：如果后续还想更细，可以再给 Harbor/Longhorn 做更偏平台运维的专项仪表盘，但当前总览 + 数据存储 + PG 备份三张看板已经能覆盖大多数实验室值班场景。
- 阻塞/风险：Harbor 与 Longhorn 当前没有再额外引入更重的专用 exporter，数据仍主要来自 `kube-state-metrics`、`kubelet_volume_stats_*`、blackbox 与 Pod/Deployment 维度；这是为了控制小集群资源占用的有意取舍。

## 2026-03-19
- 完成：为实验室环境补上一套真正可长期查看的 Grafana 总览看板，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-loki-datasource.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-overview-dashboard.yaml`；其中 Grafana 新增了 `Loki` 数据源，并自动导入 `HA Lab / Ops Overview` 看板，覆盖节点就绪数、WebApp 副本、告警数量、blackbox 最小成功率、Velero 备份统计、集群 CPU/内存、活跃告警表格和常用运维链接。
- 验证：Grafana API 已返回 `Loki` 数据源；`/api/search?query=HA%20Lab` 已命中 `HA Lab / Ops Overview`，看板 UID 为 `lab-ha-overview`；直接访问 `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview` 返回 `200`；关键 PromQL 查询（节点 Ready、WebApp 副本、Velero 成功数、最后一次备份年龄、blackbox 最小成功率）均已单独校验通过。
- 下一步：若后续值班场景继续深化，可再按需要补 `CloudNativePG` 角色、Longhorn 容量、Harbor 仓库容量等细分面板，但当前这版已经可以承担实验室总览看板角色。
- 阻塞/风险：当前 Grafana 总览主要聚焦实验室里最关键的稳态与故障面，没有追求把每个组件所有指标都堆进首页；这是为了控制维护成本和看板复杂度，方便后续 AI 或人工接手继续扩展。

## 2026-03-19
- 完成：继续补齐“运维看板”这一层，在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/` 下新增 `grafana-loki-datasource.yaml`、`grafana-lab-overview-dashboard.yaml`、`grafana-lab-data-services-dashboard.yaml`，让 Grafana 现在同时具备实验室总览与数据/存储分视图；另外同步把 Portal 加上 `Data & Storage` 入口卡片，并把访问文档补到新的看板 URL。
- 验证：Grafana API 已返回 3 个数据源（`Prometheus`、`Alertmanager`、`Loki`），并且 `/api/search?query=HA%20Lab` 已同时返回 `HA Lab / Ops Overview` 与 `HA Lab / Data & Storage` 两张看板；两条直接访问地址都返回 `200`；关键 PromQL 查询（PG Ready、SeaweedFS Ready、Longhorn Ready、PVC used/capacity、Harbor deployment ready、Velero backup age、blackbox min success）都已单独验通。
- 下一步：如果后续还要往正式值班体系走，可以继续细分 `CloudNativePG`、`Longhorn`、`Harbor` 的专项看板，但当前这两张已足够承担实验室值班总览与数据面巡检。
- 阻塞/风险：当前 `CloudNativePG` 和 `Longhorn/Harbor` 看板主要依赖 `kube-state-metrics`、`kubelet_volume_stats_*` 与 blackbox 维度，没有额外引入更重的专用监控组件；这是基于 `3 x 4C/8G` 资源约束做的有意取舍。

## 2026-03-19
- 完成：继续增强 Portal 的运维摘要能力，在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 里把快照卡片扩展为包含最新成功 GitLab pipeline、最近一次 Velero smoke backup 完成时间和最近一次 Alertmanager webhook 投递时间，让首页能更直观看到“最近一次关键验证结果”。
- 验证：`kubectl rollout restart deployment/lab-portal -n lab-portal` 后，`http://192.168.0.108:30088` 返回的新 HTML 已包含 `Velero Backup`、`Alert Delivery`、`pipeline #9` 等关键字，说明新摘要卡片已生效。
- 下一步：如果后续需要更像正式值班面板，可再补“最近一次 GitOps sync 修复时间”和“最近一次黑盒探测异常时间”，但当前这版已经够日常使用。
- 阻塞/风险：Portal 里的这些时间戳是“最后一次人工验证时写入的静态摘要”，不是浏览器实时拉取；这样做是为了保持实现简单、避免额外跨域与认证复杂度。

## 2026-03-19
- 完成：继续把 Portal 做成更像“实验室运维首页”的入口，在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 中新增 `CI Pipeline / GitOps Sync / HA Drills / Blackbox Probes` 四张快照卡片，并补充 GitLab pipelines 与测试报告的直达链接；同时保留一条简明中文注释，说明复制交互是静态辅助，实时状态真源仍在 Prometheus / GitLab。
- 验证：重启 `lab-portal` 后，`http://192.168.0.108:30088` 返回的新页面已包含 favicon、复制按钮、快照卡片和文档链接；实际抓取 HTML 时，`HA Lab Portal`、`data-copy=`、`CI Pipeline`、`TEST_REPORT.md` 均已命中。
- 下一步：如果后续还想继续完善，可以再把“最近一次备份结果”和“最近一次告警出口测试时间”做成同样的静态摘要卡片，但当前版本已经足够作为稳定的第一入口。
- 阻塞/风险：Portal 仍是静态页，不直接跨域拉取实时状态；这样做是为了避免把浏览器 CORS、凭据透出和额外复杂度带进实验环境，当前做法更稳也更好维护。

## 2026-03-19
- 完成：继续增强实验室门户页 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，为 Portal 增加专用 favicon、统一视觉风格、默认账号一键复制按钮、平台定位说明与更完整的运维提示；并通过 `kubectl rollout restart deployment/lab-portal -n lab-portal` 让基于 ConfigMap subPath 的页面更新真正生效。
- 验证：`http://192.168.0.108:30088` 已能返回新版门户 HTML，页面中已包含 `rel="icon"` 与 `data-copy` 按钮标记；Portal 继续正常可访问，主入口仍保持可用。
- 下一步：如果后续还想再提升体验，可以继续给 Portal 加“最近一次演练结果/最近一次 GitLab pipeline 状态”这类摘要信息，但当前这版已经满足日常导航、账号提示和 API/UI 区分。
- 阻塞/风险：Portal 是静态页，当前不做实时跨域健康探测，以避免引入浏览器 CORS 兼容问题；状态真源仍以 Prometheus / blackbox 与文档为准。

## 2026-03-19
- 完成：修复 GitLab 浏览器登录入口，根因是 root 用户仍保留 `password_automatically_set` 初始化标记，导致 `/users/sign_in` 持续跳转到 `/admin/initial_setup/new`；现在已通过 Rails runner 清除初始化标记，浏览器访问登录页恢复正常。
- 完成：新增实验室门户页 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，通过 `http://192.168.0.108:30088` 汇总所有当前稳定的直连地址，并在门户页明确说明 SeaweedFS S3 端口 `30333` 是 API 端口、浏览器看到 `AccessDenied` 属于预期行为。
- 验证：`curl -I http://192.168.0.108:8929/users/sign_in` 已返回 `200 OK`；门户页可直接打开；黑盒探测已追加 `portal` 目标；访问说明与接手文档同步更新。
- 下一步：如果用户仍希望把所有入口统一成一个 HTTPS 域名，可在后续有稳定 DNS/证书前提下，把门户页作为唯一入口继续扩展成“实验室运维首页”。
- 阻塞/风险：当前门户页和大部分站点入口以 `192.168.0.108:port` 形式暴露，这是为兼容当前网络环境做的稳定性优先取舍，不是最终生产级域名方案。

## 2026-03-19
- 完成：修复“浏览器里大部分链接打不开”的访问层问题，确认根因是当前用户环境对 `*.nip.io` 主机名与 Host 头入口不稳定，因此把实验室站点主入口统一改成 `192.168.0.108:port` 直连模式；同时为 `webapp-template` 增加无 host 的默认 Ingress 规则，使主站可直接通过 `http://192.168.0.108:32668` 打开，并把 Grafana/Prometheus/Alertmanager/Argo CD/Longhorn/Hubble/SeaweedFS/Harbor 都收口为各自独立的直连端口。
- 完成：同步把 `.gitlab-ci.yml`、`blackbox-values.yaml`、`ACCESS.md`、`BEST_PRACTICES.md`、`HANDOVER.md` 等配置与文档切换到直连入口口径，并重新升级 blackbox-exporter，让探测目标对齐当前真实可访问地址。
- 验证：本机直接访问 `http://192.168.0.108:32668`、`http://192.168.0.108:30002`、`http://192.168.0.108:30081`、`http://192.168.0.108:30090/graph`、`http://192.168.0.108:30093/`、`https://192.168.0.108:30443/`、`http://192.168.0.108:30084/`、`http://192.168.0.108:30085/`、`http://192.168.0.108:30888/`、`http://192.168.0.108:30086/`、`http://192.168.0.108:30333/`、`http://192.168.0.108:8929/users/sign_in` 均已得到可用响应；其中 WebApp 首页 HTML 已成功抓取，Prometheus/Alertmanager/Harbor 页面内容也已实测可读。
- 下一步：若后续用户本机代理策略已修复，可再把 `nip.io` 域名入口恢复成辅助可读地址；否则继续坚持 `IP:Port` 作为实验室默认入口即可。
- 阻塞/风险：这次修复优先保证“马上能打开”，因此访问口径从 prettier 的主机名切到了更直接的 IP:Port；主机名 Ingress 仍保留在集群里，但不再作为主推荐入口。

## 2026-03-19
- 完成：继续把实验室高可用链路补齐到可交接状态，新增并落地 `Velero`、`Sealed Secrets`、`Alertmanager webhook sink`、`Argo CD` 仓库凭据密文管理与 `webapp-template-lab` 自动同步应用；同时为 GitLab 增加独立远程 `gitlab`，把本地部署文档与实验清单以 `feat(deploy): 补齐实验室高可用部署基线`、`fix(deploy): 修正 Argo CD 应用目录`、`fix(deploy): 去重实验目录命名空间资源` 三次提交推送到实验室仓库 `git@192.168.0.108:root/webapp-template-lab.git`。
- 验证：GitLab 最近 3 条 pipeline 已全部 `success`；Argo CD `webapp-template-lab` 当前 `Synced + Healthy` 且自动同步到修正后的 `f3f81f7`；`Velero` 的 `BackupStorageLocation default` 已 `Available`，`webapp-smoke-backup` 已 `Completed`；`SealedSecret repo-webapp-template-lab` 与 `lab-sealed-example` 都已成功解封；`alert-webhook-receiver` 已收到 Alertmanager POST；`probe_success` 最小值保持为 `1`。
- 下一步：若用户后续提供飞书/钉钉/Telegram webhook 或 SMTP 参数，可把当前实验室 webhook sink 平滑替换成真实通知出口；若允许继续增强恢复能力，可追加 `Velero restore` 演练与更细粒度的定时备份策略。
- 阻塞/风险：当前仍遵循三台 VM 的实验室 HA 边界；Argo CD 仓库凭据已改为 SealedSecret 管理，但真实生产环境仍建议把 PAT/Deploy Token 再下沉到更正式的密钥管理；Velero 当前只验证了对象级备份，不承担 PVC 数据面恢复。

## 2026-03-19
- 完成：把本次三节点实验室高可用部署的关键文档、值文件、脚本和镜像归档统一收口到 `/Users/simon/projects/webapp-template/server/deploy/lab-ha`，新增 `README.md / ACCESS.md / BEST_PRACTICES.md / TEST_REPORT.md / HANDOVER.md`，并补充 `platform-ingresses.yaml`、`blackbox-values.yaml`、`webapp-governance.yaml` 等实验清单；同时更新 `/Users/simon/projects/webapp-template/server/deploy/README.md`，明确 `lab-ha/` 是当前实验室 HA 落地目录而不是模板默认基线。
- 完成：继续把实验环境打磨到可访问、可观测、可接手状态：为 Prometheus / Alertmanager / Longhorn / Hubble / SeaweedFS 新增入口，补齐 `blackbox-exporter` 探测 10 个关键站点，修正 SeaweedFS volume 索引持久化问题，切换 `webapp-template` 运行镜像到 Harbor，并确认 Harbor 镜像路径可被节点通过 containerd/CRI 拉取。
- 完成：验证层面补齐了最终收口：`bash scripts/qa/full.sh` 再次全量通过；关键 K8s 清单 `server-side dry-run` 通过；GitLab Runner `verify` 通过；GitLab CI 配置经 GitLab Lint 返回 `valid=true`；外部入口 `webapp/harbor/grafana/prometheus/alertmanager/argocd/longhorn/hubble/seaweedfs/gitlab` 均已实测可达；黑盒探测 `probe_success` 最小值为 `1`；删除一个 webapp pod 后依旧可从 Harbor 路径恢复并保持 `/readyz` 正常。
- 下一步：如果后续允许提交并推送仓库改动，就把当前 `lab-ha/` 清单和 `.gitlab-ci.yml` 真正推到 GitLab 项目里，让 Argo CD / GitLab Runner 从“已准备好”升级成“远端仓库驱动的完整 GitOps/CD 闭环”；若继续保持实验室模式，则优先补 Velero/Sealed Secrets/更强的告警出口。
- 阻塞/风险：当前仍是三台 VM 的实验室 HA，不具备硬件级高可用；虚拟化网络对 MetalLB VIP 的外部直连不稳定，因此对外统一采用 `192.168.0.108:32668` 的 NodePort + Host 域名；另外 GitLab 虽已可访问且 Runner 已就绪，但远端仓库中的 CI/CD 文件若要真正触发流水线，仍需要一次显式提交/推送把本地最新清单同步上去。

## 2026-03-19
- 完成：补齐 GitLab Shell Runner 的最小流水线入口，新增 `/Users/simon/projects/webapp-template/.gitlab-ci.yml` 与 `/Users/simon/projects/webapp-template/server/deploy/prod/webapp-template-lab.yaml`，让实验室环境中的 GitLab Runner 可以直接对 3 节点集群执行 `kubectl apply + rollout status + healthz/readyz` 校验，不再只停留在“平台组件已装好但代码仓没有最小 CD 链路”的状态。
- 验证：当前模板仓已成功推送到实验室 GitLab 项目 `http://192.168.0.108:8929/root/webapp-template-lab`；`gitlab-runner verify` 已返回 `is alive`；集群内 `webapp-template` 实例通过 `Host: app.192.168.0.108.nip.io` + ingress NodePort 返回 `/healthz=ok`、`/readyz=ready`，注册/登录/管理员登录均已实测通过。
- 下一步：若后续继续把 Harbor 镜像推送完全接入 GitLab CI，可在 Runner 节点补齐可持续的镜像构建方式（例如 rootless buildkit 或独立构建机），并把当前人工导入 containerd 的镜像分发链路替换为“CI 构建 -> Harbor -> GitOps/rollout”。
- 阻塞/风险：实验室网络对 MetalLB VIP 与部分上游镜像仓库存在可达性限制，因此当前外部访问口径以 `192.168.0.108:32668` 这类 NodePort + Host 头为主；另外流水线当前侧重部署校验，尚未把镜像构建完全收口到 GitLab Runner 内部。

## 2026-03-18
- 完成：为 `/Users/simon/projects/webapp-template/web/public/favicon.svg` 新增一套与当前首页一致的深色底 + 青色/琥珀色点缀 favicon，并在 `/Users/simon/projects/webapp-template/web/index.html` 与 `/Users/simon/projects/webapp-template/web/public/index.html` 接入统一 `icon` 引用和 `theme-color`，让模板默认标签页图标不再沿用空白或浏览器默认图标。
- 验证：已执行 `pnpm --dir /Users/simon/projects/webapp-template/web build`，构建通过；产物 `/Users/simon/projects/webapp-template/web/build/favicon.svg` 已正常生成并可被入口 HTML 引用。
- 下一步：派生项目初始化后，如果已经确定品牌名或主色，可以直接替换 `web/public/favicon.svg` 的渐变和字母标识，不需要改 JS 逻辑。
- 阻塞/风险：当前采用 SVG favicon，现代浏览器兼容性足够；若后续明确需要兼容极旧浏览器或 iOS 主屏图标，再补 `png/ico/apple-touch-icon` 即可。

## 2026-03-16
- 完成：新增 `/Users/simon/projects/webapp-template/server/configs/dev/config.local.example.yaml`，把本地私有覆盖的最小推荐字段固定成可跟踪示例，明确展示 `trace.jaeger.endpoint`、`data.postgres.dsn` 与 `auth` 的覆盖写法，方便模板派生项目后快速落地自己的本地配置。
- 验证：示例文件仅使用当前启动链已支持的配置路径；`make dev` 会先读公共 `config.yaml`，再由同目录未跟踪的 `config.local.yaml` 覆盖，而不是替换占位字符串。
- 下一步：若后续把模板初始化脚本继续收口，可让 `scripts/init-project.sh` 在首跑时顺手提示这份 example 文件。
- 阻塞/风险：示例文件仍保留占位值，派生项目初始化后必须自行填写真实密码和私钥。

## 2026-03-16
- 完成：做了模板仓库最后一轮去 MySQL 清理，删除已废弃的 `/Users/simon/projects/webapp-template/server/deploy/confs/mysql8.cnf`；复查主干后，除 Ent 上游生成的通用 `server/internal/data/model/ent/client.go` 外，模板现行代码、配置和文档已经没有运行态/文档态 MySQL 残留。
- 验证：已执行仓库级复查，`rg -n 'MYSQL_DSN|mysql|MySQL' . --glob '!progress.md' --glob '!server/internal/conf/*.pb.go' --glob '!server/internal/data/model/ent/client.go'` 在 `/Users/simon/projects/webapp-template` 下无结果，确认当前模板主干已全面切到 PostgreSQL 口径。
- 下一步：若模板后续继续派生新项目，可以把“默认只支持 PostgreSQL”写入初始化脚本提示，避免派生仓库又手工拷回旧 MySQL 文件。
- 阻塞/风险：同样地，`server/internal/data/model/ent/client.go` 的 `dialect.MySQL` 分支来自 Ent 上游通用生成，不影响当前模板实际运行，但若要做到字面级完全清零，需要接管生成器模板。

## 2026-03-16
- 完成：为 `/Users/simon/projects/webapp-template/server/Makefile` 增加 `dev_stop` 与 `dev_restart`，按模板项目当前本地后端端口 `8200 9200` 自动清理旧 dev 进程，并兼容 `lsof` / `fuser`，减少切项目时端口残留导致的启动失败。
- 验证：已执行 `cd /Users/simon/projects/webapp-template/server && make dev_stop && make help | rg 'dev_stop|dev_restart'`，目标可以正常执行并出现在帮助列表中。
- 下一步：若模板后续还会派生更多项目，可把 `DEV_PORTS` 作为初始化脚本需要同步替换的变量，避免派生后忘记改端口。
- 阻塞/风险：当前 `dev_stop` 仍只覆盖模板后端；若你同时开着模板前端 `5175`，仍需要单独在 web 目录管理或另补前端脚本。

## 2026-03-16
- 完成：修复模板项目本地无法独立访问的问题。根因是 `/Users/simon/projects/webapp-template/server/configs/dev/config.yaml` 仍占用 `8000/9000`，与 `collision-simulator` 本地后端撞端口，导致模板服务起不来；同时 `/Users/simon/projects/webapp-template/web/vite.config.js` 也仍把代理指向 `localhost:8000`。现已把模板开发后端改到 `8200/9200`，前端 dev server 固定到 `5175` 并同步代理到 `8200`。
- 验证：已启动本地模板后端并清掉旧的 `8000/9000` 模板进程，`curl http://127.0.0.1:8200/healthz` 返回 `ok`，`curl http://127.0.0.1:5175/rpc/auth` 调用 `admin_login` 也已返回 `code=0`。
- 下一步：若后续还会新增更多本地派生项目，建议继续沿用“前端/后端端口显式分配”的做法，避免再靠 Vite 自动顺延端口。
- 阻塞/风险：模板本地服务现已能独立跑，但仍依赖 `config.local.yaml` 里的远端 PG DSN；如果远端库暂时不可达，前端页面仍会表现为后端报错而不是纯前端问题。

## 2026-03-16
- 完成：修正模板仓库生产口径里残留的旧库名 `test_database_atlas`，`/Users/simon/projects/webapp-template/server/configs/prod/config.yaml`、`/Users/simon/projects/webapp-template/server/deploy/compose/prod/compose.yml`、`/Users/simon/projects/webapp-template/server/deploy/compose/prod/.env.example` 已统一切到 `webapp_template`，并补上 PostgreSQL 18 所需的 `/var/lib/postgresql` 挂载方式与 `host.docker.internal` 兜底映射。
- 完成：已在 `47.84.12.211` 备份原环境与 MySQL dump（目录同 `/root/deploy/pg-migration-20260316T113507`），完成 `webapp_template` 的 PostgreSQL baseline 迁移、兼容数据导入、镜像发布与服务切换；当前 `webapp-template-server` 已直连 `webapp-template-postgres`，旧 `webapp-template-mysql` 已停止但未删除。
- 验证：已通过 `atlas migrate status` 确认 `webapp_template` 到最新版本，`users/admin_users` 数据已从 MySQL 同步（各 `1` 行），`http://47.84.12.211:8200/healthz` 与 `http://47.84.12.211:8200/readyz` 均返回 `ok/ready`。
- 下一步：若后续有真实派生项目继续沿用该模板，建议在初始化阶段一并把 `PROJECT_SLUG`、数据库名和远端密码替换为项目专属值，避免长期复用模板默认凭据。
- 阻塞/风险：模板仓库的 MySQL 历史数据本就较少，当前只保留现有 PostgreSQL schema 能承接的部分；若以后又把被裁掉的模板字段/表加回来，需要重新评估是否补历史数据。

## 2026-03-16
- 完成：补齐本地开发配置收口，`/Users/simon/projects/webapp-template/web/.gitignore` 现已忽略 `.vite-cache/`，`/Users/simon/projects/webapp-template/server/.gitignore` 现已忽略 `configs/dev/config.local.yaml`；同时将 `/Users/simon/projects/webapp-template/server/configs/dev/config.yaml` 改回无密钥的本地 PostgreSQL 默认值，并让 `/Users/simon/projects/webapp-template/server/cmd/server/main.go` 支持自动叠加未跟踪的 `config.local.yaml`，避免远端私有 DSN 继续污染工作区。
- 验证：已执行 `cd /Users/simon/projects/webapp-template/server && go test ./cmd/server`，命令通过；`git status --short` 也已确认 `.vite-cache/` 与 `config.local.yaml` 不再作为未跟踪噪声出现。
- 下一步：若模板后续还要派生新项目，可在初始化脚本里追加一条提示，提醒开发者优先写 `configs/dev/config.local.yaml`，不要直接改公共 `config.yaml`。
- 阻塞/风险：当前远端私有 DSN 仍保存在本机未跟踪的 `config.local.yaml` / `.env` 中；这对安全更好，但换机器时需要手动复制本地覆盖文件。

## 2026-03-16
- 完成：将 `/Users/simon/projects/webapp-template/web/vite.config.js` 的开发缓存目录改为仓库内独立 `.vite-cache`，避免与其他项目共用 `/tmp/.vite-cache` 时出现 `Outdated Optimize Dep` 和懒加载页面动态导入失败。
- 验证：已执行 `cd /Users/simon/projects/webapp-template/web && pnpm build`，构建通过。
- 下一步：模板派生项目可直接沿用这套仓库隔离缓存配置，减少多项目并行开发时的 Vite 依赖缓存抖动。
- 阻塞/风险：若机器上已有旧 dev server 进程未重启，旧进程仍会继续使用它启动时的共享缓存路径。

## 2026-03-16
- 完成：将远端 MySQL `test_database_atlas` 的可兼容数据迁入 PostgreSQL `webapp_template`；当前 `users` 表 `62` 行已全部导入并校验一致，同时清理了远端旧测试库 `test_database_atlas`。
- 验证：已对 MySQL `users` 与 PostgreSQL `users` 执行行数比对，结果均为 `62`；当前 `webapp_template` 的 `atlas migrate status` 仍为 `Already at latest version`。
- 下一步：若你希望模板仓库也做到“完全无损迁移”，需要先决定是否把已从 PostgreSQL schema 中移除的 `invite_codes` 表，以及 `users.invite_code / role / points / expires_at` 这些历史字段补回当前模板 schema；确认后可继续补第二轮迁移。
- 阻塞/风险：当前模板仓库并未 100% 无损迁移——MySQL 里仍有 `invite_codes` `14` 行，以及 `users` 的 4 个历史字段在现有 PostgreSQL schema 中无对应落点；这些数据还保留在源 MySQL 中，但尚未进入 `webapp_template`。

## 2026-03-16
- 完成：将远端模板开发库从 `test_database_atlas` 收口为项目名 `webapp_template`；已在 `192.168.0.106:5432` 上创建新库、执行 baseline 迁移，并同步更新 `/Users/simon/projects/webapp-template/server/configs/dev/config.yaml` 与 `/Users/simon/projects/webapp-template/server/.env`，让运行时配置和命令行/Atlas 使用同一套远端项目库。
- 验证：已执行 `atlas migrate apply --dir 'file://internal/data/model/migrate' --url 'postgres://test_user:***@192.168.0.106:5432/webapp_template?sslmode=disable'`，以及 `cd /Users/simon/projects/webapp-template/server && set -a && source .env && set +a && atlas migrate status --dir 'file://internal/data/model/migrate' --url "$DB_URL" && psql "$DB_URL" -Atc "SELECT current_database(), count(*) FROM information_schema.tables WHERE table_schema='public';"`，当前迁移状态 `Already at latest version`，`public` 下 2 张表。
- 下一步：如果模板后续初始化为真实项目，建议在 `scripts/init-project.sh` 收口阶段顺带重命名远端库和账号，避免派生项目长期沿用模板库名。
- 阻塞/风险：旧库 `test_database_atlas` 仍保留在远端，短期可回退，但也保留了命名混淆；当前模板 dev 配置直连共享远端库，派生项目联调前最好再拆独立库。

## 2026-03-16
- 完成：使用远端 PG18 超级用户 `test_user` 在 `192.168.0.106:5432` 上创建 `test_database_atlas` 数据库并执行模板 baseline 迁移，随后将 `/Users/simon/projects/webapp-template/server/configs/dev/config.yaml` 改为直连远端 `test_database_atlas`。
- 验证：已执行 `atlas migrate apply --dir 'file://internal/data/model/migrate' --url 'postgres://test_user:***@192.168.0.106:5432/test_database_atlas?sslmode=disable'`，并通过 `psql 'postgres://test_user:***@192.168.0.106:5432/test_database_atlas?sslmode=disable' -Atc "SELECT current_database(), count(*) FROM information_schema.tables WHERE table_schema='public';"` 确认模板库 schema 已落库（当前 `public` 下有 2 张表）。
- 下一步：如需把模板仓库也接到真实页面 smoke，可再补一个适配 `test_user` 的 `cmd/dbcheck` 默认账号，避免后续每次手动覆盖环境变量。
- 阻塞/风险：模板 dev 配置现已直接连远端共享 PG18，派生项目若沿用这份配置，写操作会落到同一个 `test_database_atlas`；正式派生前建议换成项目独立库。

## 2026-03-16
- 完成：将 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/compose.yml`、`/Users/simon/projects/webapp-template/server/deploy/README.md` 与 `/Users/simon/projects/webapp-template/server/Makefile` 的 PostgreSQL 本地基线统一提升到 18，确保模板默认生成/部署口径与远端 PostgreSQL 18 一致。
- 验证：已执行 `cd /Users/simon/projects/webapp-template && docker compose -f server/deploy/compose/prod/compose.yml --env-file server/deploy/compose/prod/.env.example config`，当前模板 compose 可正常解析到 `postgres:18`。
- 下一步：若模板派生项目也需要直接连 `192.168.0.106`，后续可按真实库名和账号把 `/Users/simon/projects/webapp-template/server/configs/dev/config.yaml` 单独切到远端 PG18。
- 阻塞/风险：模板仓库暂无远端 PG18 的专属库名/账号，本次只先统一版本，不直接改远端 dev DSN，避免把模板默认值绑死到不确定的外部实例。

## 2026-03-16
- 完成：将 `/Users/simon/projects/webapp-template/server/internal/conf/conf.proto`、`/Users/simon/projects/webapp-template/server/configs/dev/config.yaml`、`/Users/simon/projects/webapp-template/server/configs/prod/config.yaml`、`/Users/simon/projects/webapp-template/server/cmd/server/main.go` 与 `/Users/simon/projects/webapp-template/server/internal/data/data.go` 的数据库主配置从 `mysql` 统一迁移为 `postgres`，运行时改用 `github.com/jackc/pgx/v5/stdlib` + `database/sql`，并把启动重试、日志文案、`POSTGRES_DSN` 覆盖和 `/readyz` 文案同步切到 PostgreSQL。
- 完成：修正 `/Users/simon/projects/webapp-template/server/internal/data/admin_user_init.go`、`/Users/simon/projects/webapp-template/server/internal/data/admin_auth_repo.go` 等原生 SQL 的 PostgreSQL 占位符与布尔写法，替换 `/Users/simon/projects/webapp-template/server/internal/data/model/migrate` 里的旧 MySQL 迁移历史为当前 Ent schema 生成的 PostgreSQL baseline，并重新生成 `/Users/simon/projects/webapp-template/server/internal/conf/conf.pb.go`、Ent 代码与 Wire 产物。
- 完成：同步更新 `/Users/simon/projects/webapp-template/server/cmd/dbcheck/main.go`、`/Users/simon/projects/webapp-template/server/Makefile`、`/Users/simon/projects/webapp-template/server/.env*`、`/Users/simon/projects/webapp-template/server/deploy/compose/prod/*` 与 `/Users/simon/projects/webapp-template/server/deploy/*/configmap.yaml`，让本地 compose、Atlas/Ent 工作流、数据库检查脚本与部署模板默认都改为 `postgres` 服务名、`5432` 容器端口和 `postgres://...?...sslmode=disable` 连接串；同时把本地宿主机默认映射口径对齐到 `5433` 并显式固定 compose project name，避免与 `collision-simulator` / `trade-erp` 并行调试时出现 PostgreSQL 端口或默认网络冲突。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && make config`、`go run -mod=mod entgo.io/ent/cmd/ent generate --target ./internal/data/model/ent ./internal/data/model/schema`、`go generate ./cmd/server`、`make ent_migrate`、`go test ./internal/data ./internal/server ./cmd/...`、`go test ./...`，以及 `cd /Users/simon/projects/webapp-template && docker compose -f server/deploy/compose/prod/compose.yml --env-file server/deploy/compose/prod/.env.example config`。
- 下一步：如果后续要把模板真正落到线上环境，还需要在目标环境准备 PostgreSQL 数据目录/备份策略，并按真实部署方式执行一次从旧 MySQL 数据到新 PostgreSQL 的数据迁移演练；本次模板仓库未包含历史业务数据搬迁脚本。
- 阻塞/风险：`server/internal/data/model/ent/client.go` 仍会保留 Ent 生成的 `dialect.MySQL` 分支，这是上游生成代码的通用兼容逻辑，不影响当前模板实际已切到 PostgreSQL；另外 `/Users/simon/projects/webapp-template/server/.env` 仍指向现有宿主机地址，只是协议和端口已改为 PostgreSQL，真实可连通性取决于外部数据库是否已就绪。

## 2026-03-14
- 完成：补充 `/Users/simon/projects/webapp-template/server/pkg/taskgroup/taskgroup.go` 的日志 helper 收尾修正，显式忽略底层 `Logger.Log(...)` 返回值，消除 `errcheck` 门禁阻断且不改变现有日志行为。
- 完成：补充 `/Users/simon/projects/webapp-template/server/pkg/taskgroup/README.md` 的“三种常见方案对照”章节，使用同一个 PDF 预览/下载目标分别演示 `errgroup`、`oklog/run.Group`、`taskgroup` 的适用层级，便于后续派生项目在请求级、组件级、对象级三类生命周期之间做快速选型。
- 完成：将 `/Users/simon/projects/webapp-template/server/pkg/threading` 重命名为 `/Users/simon/projects/webapp-template/server/pkg/taskgroup`，同步更新 `cmd/server` 引用、README、测试文件与默认实例命名，让包名更贴近 Go 里“后台任务组生命周期管理”的常见语义。
- 完成：在 `/Users/simon/projects/webapp-template/server/pkg/taskgroup/taskgroup.go` 增加最小结构化日志与轻量 trace event，覆盖任务接收、拒绝、退出、panic、`Stop(...)` 开始、超时与取消派发等关键收口节点；同时新增 `WithOperation(...)`、`WithTaskName(...)` helper，便于调用侧把业务语义带进日志字段。
- 完成：更新 `/Users/simon/projects/webapp-template/server/pkg/taskgroup/README.md`，将包定位、正确用法、最小观测建议和 helper 示例一起收口到新路径，避免目录名和文档语义继续错位。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && go test ./pkg/taskgroup`、`go test -race ./pkg/taskgroup`、`go test -count=20 ./pkg/taskgroup`、`go test ./cmd/server`。
- 下一步：如果后续有真正的后台任务调用点接入 `taskgroup`，可以按需在调用侧补 `WithOperation(...)` / `WithTaskName(...)`，让超时、panic 和退出日志直接带上业务动作名。
- 阻塞/风险：当前 `taskgroup` 的最小日志默认只带基础字段，只有调用侧显式注入 `operation` / `task_name` 时才会呈现更完整的业务语义；同时 `Stop(...)` 本身不接收 `ctx`，因此停止流程日志暂时无法天然挂到某条上游 trace 上。

## 2026-03-13
- 完成：修复 `/Users/simon/projects/webapp-template/server/pkg/threading/threading.go` 的两个并发问题：将任务准入与 `WaitGroup` 计数收口到同一临界区，避免 `Go` 与 `Stop(true, ...)` 交错时漏等；同时把运行态清理提升为 `defer`，保证 goroutine panic 后也会删除 `running` 并归还 `WaitGroup` 计数。
- 完成：调整 `/Users/simon/projects/webapp-template/server/pkg/threading/threading_default.go`，在 `Init()` 返回的 cleanup 中重置默认实例，避免测试或进程内重复初始化时卡在 `errRepeatedInit`。
- 完成：重写 `/Users/simon/projects/webapp-template/server/pkg/threading/threading_test.go` 与 `threading_more_test.go`，改为 channel 驱动的稳定断言，覆盖默认实例初始化、父 context 脱钩、`Stop(false)` 取消、`Stop(true)` 等待/超时、panic 收尾与重复 Stop 等关键语义。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && go test ./pkg/threading`、`go test -race ./pkg/threading`、`go test -count=30 ./pkg/threading`。
- 下一步：若后续这个线程管理器要承接更复杂的后台任务，可以再评估是否需要补“自定义 panic 回调阻塞”或“任务内派生子 goroutine”这类更强约束的说明或测试。
- 阻塞/风险：当前 `Threading` 仍依赖任务实现方主动监听 `ctx.Done()` 才能在 `Stop(false)` 或超时取消后及时退出；这是现有设计边界，本次未改变。

## 2026-03-13
- 完成：将 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 与 `README.md` 中的目标服务器地址彻底收口为占位域名/显式变量，发布脚本改为必须显式设置 `REMOTE_HOST`。
- 验证：已人工复核当前模板仓库的部署脚本与文档，不再包含固定线上服务器 IP。
- 下一步：后续派生项目沿用该模板时，统一通过环境变量显式指定目标宿主机，避免模板把旧地址带进新项目。
- 阻塞/风险：移除默认目标主机后，若本地脚本或外部自动化没有补 `REMOTE_HOST`，发布会直接失败并提示修正。

## 2026-03-13
- 完成：将 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/compose.yml`、`.env.example`、`deploy_server.sh`、`publish_server.sh` 与 `README.md` 收口为当前项目实际可用的独立部署配置，固定 `PROJECT_SLUG=webapp-template`、独立 MySQL/Jaeger 默认值、4G 单机预算和远端资源预检。
- 完成：修复 `/Users/simon/projects/webapp-template/server/Dockerfile`，补齐前端错误码生成依赖；同时修正 compose 默认 `MYSQL_DSN` 与 MySQL 初始化默认值，避免上线时继续使用模板占位值 `root:replace-me@tcp(mysql:3306)/app`。
- 完成：在线上当前宿主机新建并导入 `webapp-template-mysql` 独立数据目录，迁入 `test_database_atlas`；首次发版因占位 DSN 回归触发 `1045 Access denied`，修正配置后已重新发布成功。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && go test ./cmd/server`；线上复核 `http://127.0.0.1:8200/healthz`、`http://127.0.0.1:8200/readyz` 均返回 `ok/ready`，且 `webapp-template-server` 仅挂在 `webapp-template_default`。
- 下一步：继续观察模板项目在真实流量或派生项目初始化时是否还会误用占位配置，并按需要把宿主机路径、Prometheus 地址等示例项进一步模板化。
- 阻塞/风险：当前 `webapp-template-mysql` 实际占用约 `405MiB / 512MiB`；虽然运行稳定，但若后续派生项目把模板直接扩成更重的后台，仍需要同步抬高资源限制并补监控。

## 2026-03-13
- 完成：为 `/Users/simon/projects/webapp-template/server/cmd/server/main.go` 增加 `MYSQL_DSN`、`TRACE_ENDPOINT` 启动覆盖；同步更新 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/compose.yml`、`.env.example` 与 `README.md`，让模板派生项目在小内存机器上可以通过 `host.docker.internal` 显式复用共享 MySQL/Jaeger，同时保持业务容器网络独立。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && go test ./cmd/server`；本次仅完成本地默认配置调整，远端宿主机当时因 SSH banner 交换超时，尚未完成最新版发布与实机验证。
- 下一步：待远端宿主机恢复后，重新发布 `webapp-template-server`，并确认容器仅保留 `webapp-template_default` 网络、通过 `MYSQL_DSN` / `TRACE_ENDPOINT` 访问共享基础设施。
- 阻塞/风险：线上旧 `webapp-template-server` 仍可能保留历史串网状态；在未重建前，仍有继续依赖 `collision-simulator_default` 的风险。

## 2026-03-13
- 完成：扩展 `/Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.js`，新增 `getActionErrorMessage(...)`，把标准“动作失败，请稍后重试”场景从页面里重复手写整句中文，收口成动作型 helper。
- 完成：将 `/Users/simon/projects/webapp-template/web/src/pages/Login/index.jsx`、`AdminLogin/index.jsx`、`Register/index.jsx`、`AdminUsers/index.jsx` 改为优先使用 `getActionErrorMessage(...)`，并同步更新项目级 `/Users/simon/projects/webapp-template/AGENTS.md`，明确模板和派生项目后续优先沿用动作型 helper。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/web && pnpm test`，以及 `pnpm exec eslint --ext .js --ext .jsx src/common/utils/errorMessage.js src/pages/Login/index.jsx src/pages/AdminLogin/index.jsx src/pages/Register/index.jsx src/pages/AdminUsers/index.jsx`。
- 下一步：后续模板新增鉴权页或后台页时，标准失败提示默认直接写动作词，例如 `getActionErrorMessage(err, '登录')`，只有特殊文案再回退到 `getUserFacingErrorMessage(...)`。
- 阻塞/风险：无。

## 2026-03-13
- 完成：更新 `/Users/simon/projects/webapp-template/AGENTS.md`，新增“前端错误提示约定”，明确模板和后续派生项目都应通过 `web/src/common/utils/errorMessage.js` 的 `getUserFacingErrorMessage(...)` 统一翻译已知错误，并在调用点补场景化中文 fallback。
- 验证：已人工复核项目级 AGENTS 与当前模板前端错误提示实现一致；本次仅更新协作约定，未改运行时代码，未额外执行测试。
- 下一步：后续模板新增页面或派生项目初始化时，默认沿用该约定，不再直接生成 `err?.message || ...` 这类用户提示写法。
- 阻塞/风险：无。

## 2026-03-13
- 完成：扩展 `/Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.js`，新增统一 `getUserFacingErrorMessage(...)` 收口前端用户可见错误文案，优先复用错误码默认文案，并把 `Network error`、`HTTP error xxx`、`JSON-RPC error` 等英文 transport 兜底翻译成中文，避免模板继续把英文原文透传到 UI。
- 完成：将 `/Users/simon/projects/webapp-template/web/src/pages/Login/index.jsx`、`AdminLogin/index.jsx`、`Register/index.jsx`、`AdminUsers/index.jsx` 中直接展示 `err.message` / `e.message` 的入口统一改为走 helper；同时把 `/Users/simon/projects/webapp-template/web/src/common/utils/request.js` 的英文网络错误兜底改成中文。
- 完成：新增 `/Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.test.mjs`，并更新 `/Users/simon/projects/webapp-template/web/package.json` 测试入口，确保模板层后续不会回归到“英文原文直接上屏”。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/web && pnpm test` 与 `cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --ext .js --ext .jsx src/common/utils/errorMessage.js src/common/utils/request.js src/pages/Login/index.jsx src/pages/AdminLogin/index.jsx src/pages/Register/index.jsx src/pages/AdminUsers/index.jsx`。
- 下一步：后续若有派生项目继续沿用模板鉴权页或后台页，默认直接复用这套 helper，不要再在页面里拼 `err?.message || ...`。
- 阻塞/风险：本次只收口模板现有入口；若派生项目新增页面绕开 helper 直接显示原始 `message`，仍会重新出现英文文案透传，需要按同一模式继续收口。

## 2026-03-11
- 完成：增强 `/Users/simon/projects/webapp-template/docs/project-init.md`，把原来的简版提示词扩展成“给 AI 的标准输入模板”，补齐推荐准备信息、完整输入模板、最小版输入模板和 AI 输出期望，方便后续接甲方项目时直接复制给 AI 初始化。
- 完成：同步更新 `/Users/simon/projects/webapp-template/docs/README.md` 与 `/Users/simon/projects/webapp-template/README.md` 的入口说明，明确初始化指南里已经包含 AI 初始化输入模板。
- 验证：本次仅修改文档，未改运行时代码，未额外执行代码级测试。
- 下一步：后续若要继续降低初始化成本，可再补一版“行业项目初始化示例输入”，例如管理后台型、工具平台型、内容站型三种常见模板。
- 阻塞/风险：当前输入模板已经覆盖大部分初始化场景，但具体项目若涉及复杂权限、支付、审计或多租户，仍需要人工补充更细的业务约束，AI 不能仅靠模板自行推断。

## 2026-03-10
- 完成：再次收紧模板 UI 的人话表达，统一 `/Users/simon/projects/webapp-template/web/src/pages/Home/index.jsx`、`Login/index.jsx`、`Register/index.jsx`、`AdminLogin/index.jsx`、`AdminMenu/index.jsx`、`AdminGuide/index.jsx`、`AdminUsers/index.jsx` 的文案口径，去掉中英混搭和过重的“模板内部说明”，并把后台说明页从命令清单收成面向人的页面说明。
- 验证：待执行前端 `lint/build`，确认这轮文案与布局收口未引入页面回归。
- 下一步：如后续继续打磨模板展示层，可再评估首页是否要支持通过环境变量注入项目副标题，进一步减少初始化后的手工改字成本。
- 阻塞/风险：本次主要调整文案和信息层级，没有改变页面路由和鉴权流程；后台说明页中的开发命令已移回文档语境，不再直接展示在 UI 中。

## 2026-03-10
- 完成：为 `/Users/simon/projects/webapp-template/web/src/pages/Login/index.jsx` 与 `/Users/simon/projects/webapp-template/web/src/pages/Register/index.jsx` 补上和管理员登录页一致的“返回首页”入口，统一三张鉴权页的最小导航闭环。
- 验证：待执行前端 `lint/build`，确认返回入口补充未引入页面回归。
- 下一步：如后续继续收口模板 UI，可再评估首页是否需要把“普通用户首次先注册”做成更明显的首屏提示。
- 阻塞/风险：本次只补静态返回链接，不改变登录、注册和跳转成功后的鉴权流程。

## 2026-03-10
- 完成：为 `/Users/simon/projects/webapp-template/web/src/pages/AdminLogin/index.jsx` 增加轻量的“返回首页”入口，补齐管理员登录页的最小导航闭环，避免用户误入后缺少明显返回路径。
- 验证：待执行前端 `lint/build`，确认导航补充未引入页面回归。
- 下一步：如后续继续收口模板 UI，可再评估是否需要为普通登录/注册页也补一个一致的返回首页入口。
- 阻塞/风险：本次只增加静态返回链接，不改变管理员登录流程和跳转逻辑。

## 2026-03-10
- 完成：收紧首页与鉴权页的模板 UI 文案，更新 `/Users/simon/projects/webapp-template/web/src/pages/Home/index.jsx`、`Login/index.jsx`、`Register/index.jsx`、`AdminLogin/index.jsx`，把“模板术语”压缩为更直接的人类操作指引，明确普通用户默认无预置账号、首次应先注册，管理员入口会按服务端配置自动创建默认账号。
- 验证：待执行前端 `lint/build`，确认文案与结构调整未引入页面回归。
- 下一步：如后续继续收口模板展示层，可把后台入口页也进一步压成“账号目录 + 项目说明”的最小首屏。
- 阻塞/风险：本次只改文案与信息层级，未改变鉴权流程本身；管理员默认账号仍取决于服务端配置，页面只做引导不直接展示密码。

## 2026-03-10
- 完成：修正 `/Users/simon/projects/webapp-template/scripts/init-project.sh` 中触发 `shellcheck` 的中文引号，将模板提示文案改为 ASCII 单引号，保证 `pre-commit` 在提交模板收口改动时不会因 `SC1111` 被阻断。
- 验证：已按 `pre-commit` 暴露的报错位置完成修复，待重新执行提交流程验证整套钩子。
- 下一步：重新执行 `git commit` 与 push，确保本次模板收口改动可以完整入库。
- 阻塞/风险：无。

## 2026-03-10
- 完成：新增薄的 HTTP `request_id` 过滤器 `/Users/simon/projects/webapp-template/server/internal/server/request_id_filter.go`，统一透传或生成 `X-Request-Id`，回写响应头并注入 context；`/Users/simon/projects/webapp-template/server/internal/server/http.go` 现已在 HTTP server 上默认启用该过滤器。
- 完成：扩展日志上下文字段 `/Users/simon/projects/webapp-template/server/pkg/logger/default.go`，默认 logger 会自动输出 `request_id`；这样 `service`、`biz`、`data` 层只要使用 `WithContext(ctx)` 记录日志，就能自动带上 HTTP request id。
- 完成：新增 `/Users/simon/projects/webapp-template/server/internal/server/request_id_filter_test.go`，覆盖上游透传与服务端自动生成两种场景，验证响应头、context 与日志字段三者一致；并同步更新 `/Users/simon/projects/webapp-template/server/docs/runtime.md`、`/Users/simon/projects/webapp-template/server/docs/observability.md`、`/Users/simon/projects/webapp-template/README.md`。
- 验证：已通过 `gofmt -w /Users/simon/projects/webapp-template/server/pkg/logger/default.go /Users/simon/projects/webapp-template/server/internal/server/http.go /Users/simon/projects/webapp-template/server/internal/server/request_id_filter.go /Users/simon/projects/webapp-template/server/internal/server/request_id_filter_test.go`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/server ./internal/data ./cmd/...`。
- 下一步：如果后续继续强化观测，可把 request id 方案扩展到 gRPC / 异步任务，并逐步把 JSON-RPC 文本日志改成字段化结构日志。
- 阻塞/风险：当前 request id 自动生成只覆盖 HTTP 请求；gRPC、后台任务、离线脚本还没有统一 request id 注入方案，因此跨协议串联日志时仍要主要依赖 `trace_id`。

## 2026-03-10
- 完成：一次性补齐 HTTP 健康检查链路的观测缺口：`/Users/simon/projects/webapp-template/server/internal/server/http.go` 已启用 HTTP tracing middleware，新增 `/Users/simon/projects/webapp-template/server/internal/server/http_custom_handlers.go` 为自定义健康检查和静态资源路由提供统一观测包装，补上 trace、panic recover 和结构化收尾日志，避免这些自定义 handler 继续裸挂。
- 完成：`/readyz` 失败分支现在会输出结构化告警日志，带 `operation`、`component`、`status`、`request_id`、`trace_id` 和错误原因；同时保留 `/healthz`、`/readyz` 的最小文本响应，兼容现有 smoke / probe 行为。
- 完成：新增 `/Users/simon/projects/webapp-template/server/internal/server/http_health_test.go`，覆盖 `/healthz` 200、`/readyz` 200、`/readyz` 503 + 结构化失败日志，作为这次观测性修复的回归测试；并同步更新 `/Users/simon/projects/webapp-template/server/docs/observability.md`、`/Users/simon/projects/webapp-template/server/docs/runtime.md`、`/Users/simon/projects/webapp-template/README.md`，让文档与当前真实行为一致。
- 验证：已通过 `gofmt -w /Users/simon/projects/webapp-template/server/internal/server/http.go /Users/simon/projects/webapp-template/server/internal/server/http_custom_handlers.go /Users/simon/projects/webapp-template/server/internal/server/http_health_test.go`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/server ./internal/data ./cmd/...`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`。
- 下一步：如果后续继续收口，可考虑为 `/readyz` 增加组件级 JSON 响应，并给 JSON-RPC 入口日志补更强的字段化结构，而不是继续只靠 `Infof/Warnf` 文本。
- 阻塞/风险：当前 HTTP 关键链路的 trace 与健康检查日志已补齐，但全局仍没有统一 request id 生成中间件，`request_id` 目前主要依赖上游请求头透传；如果后续项目需要稳定串联日志，建议再加统一 request id 方案。

## 2026-03-10
- 完成：补齐 `/Users/simon/projects/webapp-template/server/docs` 的服务端文档集合，新增 `/Users/simon/projects/webapp-template/server/docs/README.md`、`runtime.md`、`config.md`、`api.md`、`observability.md`，把运行方式、配置结构、JSON-RPC 默认入口、健康检查与观测基线统一收口成可直接供模板初始化使用的后端文档入口。
- 完成：重写 `/Users/simon/projects/webapp-template/server/docs/ent.md`，去掉旧的 `entimport` 历史说明，改为当前真实使用的 Ent + Atlas 工作流；同时更新 `/Users/simon/projects/webapp-template/server/README.md`、`/Users/simon/projects/webapp-template/server/internal/biz/README.md`、`/Users/simon/projects/webapp-template/server/internal/data/README.md`、`/Users/simon/projects/webapp-template/server/internal/service/README.md`，让根入口与分层说明对齐当前模板主干。
- 完成：同步补齐根级文档索引 `/Users/simon/projects/webapp-template/README.md` 与 `/Users/simon/projects/webapp-template/docs/README.md`，让 `server/docs` 新文档可以从仓库顶层直接找到。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/init-project.sh`；本次仅修改文档，未改运行时代码，未额外执行代码级测试。
- 下一步：若后续继续收口服务端模板，可优先补健康检查路由测试和 `readyz` 结构化失败日志，再把 `observability.md` 中列出的盲区逐项消掉。
- 阻塞/风险：当前文档已覆盖模板默认基线，但仍是按“最小可复用骨架”写法保留，未预埋具体行业 API、Ingress、ExternalSecret、复杂运维方案；这些能力仍应由派生项目按真实环境补充。

## 2026-03-10
- 完成：把 `/Users/simon/projects/webapp-template/server/deploy` 收口成完整部署模板目录，新增 `/Users/simon/projects/webapp-template/server/deploy/README.md` 作为总览，并补齐 `/Users/simon/projects/webapp-template/server/deploy/dashboard/README.md`、`/Users/simon/projects/webapp-template/server/docs/k8s.md`，明确 Compose、Kubernetes、Dashboard 三类模板各自的适用场景、占位符和裁剪边界。
- 完成：补齐 Kubernetes 模板缺失的基础骨架，在 `/Users/simon/projects/webapp-template/server/deploy/dev` 与 `/Users/simon/projects/webapp-template/server/deploy/prod` 新增 `namespace.yaml` 和 `kustomization.yaml`，让清单可以直接通过 `kubectl apply -k` 使用，不再只有零散的 `deployment/service/configmap/secret` 文件。
- 完成：更新 `/Users/simon/projects/webapp-template/scripts/init-project.sh`、`/Users/simon/projects/webapp-template/docs/project-init.md`、`/Users/simon/projects/webapp-template/README.md`、`/Users/simon/projects/webapp-template/server/README.md`、`/Users/simon/projects/webapp-template/docs/README.md`、`/Users/simon/projects/webapp-template/scripts/README.md` 与 Compose 部署说明，确保初始化扫描会检查 `your-project`、`registry.example.com`、`deploy.example.com`、`dashboard.example.local`、`replace-me` 等新的部署占位符，并把部署模板入口文档串起来。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/init-project.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/shfmt.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/yamllint.sh`、`kubectl kustomize /Users/simon/projects/webapp-template/server/deploy/dev`、`kubectl kustomize /Users/simon/projects/webapp-template/server/deploy/prod`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`。
- 下一步：若后续确定模板默认不保留某类部署方式，可继续把 Compose 和 K8s 的共用占位符提炼到更统一的命名规范，并按项目需要补可选的 Ingress / ExternalSecret 模板。
- 阻塞/风险：当前 K8s 模板已完整可渲染，但 Ingress、ExternalSecret、HPA 仍刻意未预埋，避免把特定客户环境假设写死在模板主干里；派生项目若需要这些能力，应在初始化后按真实环境新增。

## 2026-03-10
- 完成：把模板默认主干里的非通用后台业务模块从代码层真正移除：删除 `/Users/simon/projects/webapp-template/server/internal/biz/admin_manage.go`、`/Users/simon/projects/webapp-template/server/internal/data/admin_manage_repo.go`、`/Users/simon/projects/webapp-template/server/internal/data/admin_init.go` 与邀请码 schema，`/Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go`、`/Users/simon/projects/webapp-template/server/internal/biz/user_admin.go`、`/Users/simon/projects/webapp-template/server/internal/data/user_admin_repo.go` 现只保留通用鉴权、管理员登录、账号目录和启用/禁用能力。
- 完成：同步精简数据模型与配置基线：`/Users/simon/projects/webapp-template/server/internal/data/model/schema/user.go`、`/Users/simon/projects/webapp-template/server/internal/data/model/schema/admin_user.go` 去掉积分 / 订阅 / 层级 / 邀请码相关字段，新增迁移 `/Users/simon/projects/webapp-template/server/internal/data/model/migrate/20260310064522_migrate.sql`；`/Users/simon/projects/webapp-template/server/internal/conf/conf.proto` 与 `server/configs/*/config.yaml` 已移除 `user_expiry_warning_days`。
- 完成：前端默认后台进一步收口到真正的最小账号目录：`/Users/simon/projects/webapp-template/web/src/pages/AdminUsers/index.jsx` 去掉“类型”列和任何业务字段展示；`/Users/simon/projects/webapp-template/scripts/init-project.sh`、`/Users/simon/projects/webapp-template/docs/project-init.md`、`/Users/simon/projects/webapp-template/README.md` 已改为“这些业务模块默认不在模板主干中，如有需要在派生项目新增”的口径。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && make config`、`go generate ./cmd/server`、`go run entgo.io/ent/cmd/ent generate --target ./internal/data/model/ent ./internal/data/model/schema`、`make ent_migrate`、`go test ./...`、`bash /Users/simon/projects/webapp-template/scripts/init-project.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`pnpm --dir /Users/simon/projects/webapp-template/web lint`、`pnpm --dir /Users/simon/projects/webapp-template/web build`、`pnpm --dir /Users/simon/projects/webapp-template/web test`。
- 下一步：如果后续某类项目经常需要“成员权限 / 组织结构 / 会员策略”这类业务能力，更适合拆成派生项目可选模块或单独模板，而不是再回灌到当前主干。
- 阻塞/风险：模板主干已去掉积分 / 订阅 / 邀请码 / 层级能力，但历史迁移文件仍会先创建旧字段再由 `20260310064522_migrate.sql` 删除；这对新项目从迁移历史初始化是安全的，只是迁移历史会保留演进痕迹。

## 2026-03-10
- 完成：将模板默认后台进一步收口为通用骨架：`/Users/simon/projects/webapp-template/web/src/pages/AdminMenu/index.jsx` 只保留“账号目录 + 项目收口指南 + 退出登录”入口，`/Users/simon/projects/webapp-template/web/src/pages/AdminUsers/index.jsx` 改为最小账号目录页，仅保留搜索、查看、启用/禁用账号，不再默认内置积分、订阅、邀请码或层级管理操作。
- 完成：新增 `/Users/simon/projects/webapp-template/web/src/pages/AdminGuide/index.jsx`，把后台初始化边界直接落成静态说明页；同时保留 `/Users/simon/projects/webapp-template/web/src/pages/AdminHierarchy/index.jsx` 作为旧导入兼容壳，旧路由 `/admin-users`、`/admin-hierarchy` 在 `/Users/simon/projects/webapp-template/web/src/App.jsx` 中已改为跳转到新的 `/admin-accounts`、`/admin-guide`。
- 完成：补齐账号目录的通用时间字段：`/Users/simon/projects/webapp-template/server/internal/biz/auth.go`、`/Users/simon/projects/webapp-template/server/internal/data/auth_repo.go`、`/Users/simon/projects/webapp-template/server/internal/data/user_admin_repo.go` 与 `/Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go` 现在会向后台账号目录返回 `created_at` / `last_login_at`，不额外引入新的业务语义。
- 完成：同步更新 `/Users/simon/projects/webapp-template/docs/project-init.md`、`/Users/simon/projects/webapp-template/README.md`、`/Users/simon/projects/webapp-template/scripts/init-project.sh`，明确模板后台默认只保留账号目录和项目收口说明页；积分 / 订阅 / 管理员层级 / 邀请码等能力已降为“服务端可选模块”，由派生项目按需继续裁剪。
- 验证：已通过 `cd /Users/simon/projects/webapp-template/server && go test ./internal/biz ./internal/data ./cmd/...`、`bash /Users/simon/projects/webapp-template/scripts/init-project.sh`、`pnpm --dir /Users/simon/projects/webapp-template/web lint`、`pnpm --dir /Users/simon/projects/webapp-template/web build`、`pnpm --dir /Users/simon/projects/webapp-template/web test`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`。
- 下一步：若要把模板主干继续做薄，可再把服务端里保留的积分 / 订阅 / 邀请码 / 管理员层级接口、错误码和 schema 进一步拆成可选模块包，减少派生项目二次裁剪面。
- 阻塞/风险：当前前端默认后台已去业务化，但服务端仍保留可选业务模块（`subscription`、`points.*`、管理员层级、邀请码等）；`scripts/init-project.sh` 已会明确提示这些残留，后续若要做到“初始化后几乎零业务清理”，还需要继续下沉或拆包。

## 2026-03-10
- 完成：新增 `/Users/simon/projects/webapp-template/scripts/init-project.sh`，把“由模板初始化后的新项目”所需处理的项目名、服务名、默认密钥、部署主机、模板文档语义、K8s/Jaeger/后台业务骨架裁剪点收口成可执行扫描脚本，并支持 `--project --strict` 作为派生项目初始化完成后的二次校验。
- 完成：新增 `/Users/simon/projects/webapp-template/docs/project-init.md`，并同步更新 `/Users/simon/projects/webapp-template/README.md`、`/Users/simon/projects/webapp-template/scripts/README.md`、`/Users/simon/projects/webapp-template/AGENTS.md`、`/Users/simon/projects/webapp-template/docs/README.md`、`/Users/simon/projects/webapp-template/scripts/bootstrap.sh`、`/Users/simon/projects/webapp-template/scripts/doctor.sh`，把“先扫描模板残留 -> 再 bootstrap/doctor/QA”的初始化流程固化到仓库入口文档与脚本里。
- 完成：收口几个明显会误导派生项目的默认元数据与开发配置：前端支持通过 `VITE_APP_TITLE` 注入标题，`web/index.html` / `web/public/index.html` 标题与描述改为中性占位，`web/.env.production` 的默认 `VITE_BASE_URL` 改回 `/`，`server/configs/dev/config.yaml` 与 `server/cmd/dbcheck/main.go` 的默认开发地址改为 `127.0.0.1`，减少初始化后首日运行环境漂移。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/init-project.sh`、`bash /Users/simon/projects/webapp-template/scripts/doctor.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/shfmt.sh`、`pnpm --dir /Users/simon/projects/webapp-template/web build`、`pnpm --dir /Users/simon/projects/webapp-template/web test`、`cd /Users/simon/projects/webapp-template/server && go test ./cmd/...`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`。
- 下一步：若要进一步降低“接甲方项目后二次清理”的心智负担，可继续把后台业务页中的积分 / 订阅 / 邀请码 / 管理员层级能力拆成更中性的模块或可选模板包。
- 阻塞/风险：`scripts/init-project.sh` 在当前模板源仓库中会按预期输出大量“派生项目必改”命中；这不是脚本问题，而是模板源仓库本身仍承载模板语义与示例配置。真正的目标仓库应在初始化收口后再执行 `--project --strict`。

## 2026-03-10
- 完成：将前端登录/注册/管理员登录体验收口为更适合模板初始化的通用基线，新增中性的应用壳层、内容容器、弹窗与首页落点，移除 `web/src` 内原有 `Casino*` / `blankPage` 命名残留，并把后台入口文案改成更通用的“管理控制台/账号管理/权限层级”表达。
- 验证：已通过 `pnpm --dir /Users/simon/projects/webapp-template/web lint`、`pnpm --dir /Users/simon/projects/webapp-template/web build`、`pnpm --dir /Users/simon/projects/webapp-template/web test`；`web/src` 内已无 `Casino*` / `blankPage` 命名残留。
- 下一步：若后续要继续提升模板初始化体验，可再把管理员功能页中的“积分/订阅/分级管理”等业务语义进一步收口成更中性的后台能力骨架。
- 阻塞/风险：当前后端管理员能力与部分后台页面仍保留较强的模板业务语义（如订阅、积分、管理员层级）；本次只对登录注册入口、默认首页与通用承载组件做了中性化收口，未扩大到整套后台业务模型。

## 2026-03-09
- 完成：将模板健康检查边界收口到项目级 `/Users/simon/projects/webapp-template/AGENTS.md` 与根 `/Users/simon/projects/webapp-template/README.md`，明确模板默认仅保留 `/healthz`、`/readyz`、MySQL 就绪基线与最小测试/日志建议，业务容器 `compose healthcheck` 和项目特有依赖检查下沉到派生项目按需决定。
- 验证：已人工复核文档口径与当前仓库实现一致；当前 `server/deploy/compose/prod/compose.yml` 中仅 MySQL 配置 `healthcheck`，服务端仍保留 `/healthz` 与 `/readyz` 入口，符合新的模板边界描述。
- 下一步：后续若派生项目长期使用 `docker compose` 且依赖容器 `healthy/unhealthy` 状态，再在派生项目中补业务容器 `healthcheck` 与额外依赖检查。
- 阻塞/风险：本次仅更新文档约束，未补健康检查测试与 `readyz` 失败日志；这些仍属于模板层可继续增强的基线项。

## 2026-03-09
- 完成：精简并重写 `/Users/simon/projects/webapp-template/AGENTS.md` 的错误码约定，把模板仓库默认采用的“服务端真源 -> 构建期生成 `errorCodes.generated.js` -> 手写 `errorCodes.js` 消费层 wrapper”模式固化下来，明确生成文件禁止手改、前端业务代码优先走 wrapper、错误码变更必须跑同步守卫。
- 完成：同步把通用错误码治理模式沉淀到全局 `/Users/simon/.codex/AGENTS.md`，并把模板层约束收口为“只保留通用鉴权分组与默认文案，项目特例下沉到派生仓库”，避免把某个项目的特殊语义反写回模板。
- 验证：已人工复核全局 AGENTS 与模板项目 AGENTS 的职责边界、路径命名和当前仓库实现一致；本次仅为协作规则更新，未改动运行时代码。
- 下一步：后续基于模板派生新项目时，默认沿用这套分层模式，再仅在派生仓库补项目特例和码位语义。
- 阻塞/风险：无。

## 2026-03-09
- 完成：将模板仓库的错误码治理升级为“服务端目录真源 + 构建期生成前端码表”的默认模式：继续以 `/Users/simon/projects/webapp-template/server/internal/errcode/catalog.go` 为唯一真源，新增 `/Users/simon/projects/webapp-template/scripts/gen-error-codes.mjs` 生成 `/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.generated.js`，并把 `/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js` 收口为消费层薄封装，便于后续新项目直接继承。
- 完成：新增 `/Users/simon/projects/webapp-template/scripts/qa/error-code-sync.sh`，并把错误码生成/同步校验接入 `/Users/simon/projects/webapp-template/web/package.json` 的 `prebuild`、`pretest`，以及 `/Users/simon/projects/webapp-template/scripts/git-hooks/pre-commit.sh`、`/Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`/Users/simon/projects/webapp-template/scripts/qa/full.sh`，让模板默认具备“前后端错误码漏同步即阻断”的基线能力。
- 完成：同步更新 `/Users/simon/projects/webapp-template/README.md` 与 `/Users/simon/projects/webapp-template/scripts/README.md` 的错误码治理文档，并补齐 `/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.test.mjs`，确保模板项目开箱即带错误码唯一性与登录态分类回归。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/qa/error-code-sync.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/errcode ./internal/data`、`cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --no-warn-ignored src/common/consts/errorCodes.js src/common/consts/errorCodes.generated.js src/common/consts/errorCodes.test.mjs`、`cd /Users/simon/projects/webapp-template/web && pnpm test`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/shfmt.sh scripts/git-hooks/pre-commit.sh scripts/qa/fast.sh scripts/qa/full.sh scripts/qa/error-code-sync.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/shellcheck.sh`。
- 下一步：后续基于模板新建项目时，可直接沿用这套“catalog.go 真源 + generated 前端码表 + QA/CI 同步校验”的默认骨架，再按项目特例补消费层函数和文案。
- 阻塞/风险：`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh` 当前已通过，`govulncheck` 显示代码可达漏洞为 0，但仍提示依赖模块中有 5 个“当前未调用”的漏洞记录；模板层本次未改动相关依赖，后续仍建议单独安排 Go/依赖升级回归。

## 2026-03-08
- 完成：把 `webapp-template` 的错误码治理收口成更适合作为模板复用的通用骨架：保留现有统一错误码目录与前端常量来源不变，并继续把“仅登录态失效才触发重新登录”的语义固定下来。
- 完成：增强 `scripts/qa/error-codes.sh`，补上仓库内绝对路径入参兼容、`.mjs` 文件支持，以及“仅在错误码语境下匹配”的规则，避免后续模板派生项目把金额、配置值等普通数字误判为错误码。
- 完成：新增模板级最小回归测试：服务端补 `server/internal/data/jsonrpc_error_mapping_test.go`，锁定 `auth.me` 未登录与 `ErrNoPermission` 的错误码映射；前端补 `web/src/common/consts/errorCodes.test.mjs` 并在 `web/package.json` 新增 `pnpm test`，锁定错误码唯一性、登录态失效分类与默认提示文案。
- 完成：同步更新 `README.md` 与 `scripts/README.md`，把模板当前已自带前端最小测试与错误码守卫说明写回文档，减少后续派生仓库遗漏。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh /Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go /Users/simon/projects/webapp-template/web/src/common/utils/jsonRpc.js /Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.js /Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js /Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.test.mjs`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/errcode ./internal/data`、`cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --no-warn-ignored src/common/consts/errorCodes.js src/common/consts/errorCodes.test.mjs src/common/utils/jsonRpc.js src/common/utils/errorMessage.js`、`cd /Users/simon/projects/webapp-template/web && pnpm test`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`。
- 下一步：后续若再派生新服务项目，建议直接复制 `server/internal/errcode/`、`web/src/common/consts/errorCodes.js`、`web/src/common/consts/errorCodes.test.mjs` 与 `scripts/qa/error-codes.sh`，再按项目语义分配具体码位。
- 阻塞/风险：`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh` 期间 `govulncheck` 仍提示本机 Go `1.26.0` 标准库漏洞（修复版本为 `1.26.1`）；当前模板门禁仍为提示模式未阻断，本次未改动相关调用链，后续若要把模板基线也收口为全绿，仍需单独升级本地/CI Go 工具链。

## 2026-03-07
- 完成：将根目录 `.n-node-version` 从 `24.11.1` 升级到 `24.14.0`，统一项目本地 Node 版本锁定。
- 完成：将 `server/Dockerfile` 与 `web/Dockerfile` 的前端构建基础镜像同步钉住到 `node:24.14.0`，避免容器与本地环境漂移。
- 验证：已复核仓库内 Node 版本声明位置；当前显式版本已与 `v24.14.0` 对齐。
- 下一步：本地执行 `n auto` 或手动切换到 `v24.14.0` 后，再运行 `bash scripts/doctor.sh` / 前端构建检查环境一致性。
- 阻塞/风险：若本机或 CI 仍使用旧版 Node 24.x，`doctor` 会继续提示版本不一致，需要同步升级运行环境。

## 2026-03-07
- 完成：在项目级 `/Users/simon/projects/webapp-template/AGENTS.md` 新增“服务端可观测性约束”，把 `trace/log`、统一包装、panic 兜底、结构化日志、观测性测试与最终交付说明要求固化到模板仓库规则中，便于后续新项目继承。
- 验证：本次为协作约定补充，已人工复核条目与仓库当前 Go 服务端模板实践一致，未涉及运行时代码行为变更。
- 下一步：后续基于模板派生的新项目默认沿用这套约束；如需更严格，可再补一条“新增自定义路由必须附观测性测试”的 review 清单。
- 阻塞/风险：无。

## 2026-02-20
- 完成：落地最小侵入基线策略：`pre-commit` 的 Go 检查改为“仅改动包 + `golangci-lint` 仅新增问题（`--new-from-rev HEAD`）”；YAML 检查改为“默认仅变更文件，`YAMLLINT_ALL=1` 才全量”。
- 完成：新增并启用根目录 `.yamllint`（降噪规则 + 忽略锁文件/生成目录），并同步更新 `scripts/README.md` 与根 `README.md` 的门禁说明。
- 验证：三仓库执行 `go-vet`、`golangci-lint`、`yamllint` 与 `scripts/git-hooks/pre-commit.sh` 均通过，`doctor` 显示依赖与脚本检查全部通过。
- 下一步：若要治理历史存量问题，可在不影响当前门禁的前提下分批执行 `YAMLLINT_ALL=1` 与 `GOLANGCI_ONLY_NEW=0` 清理。
- 阻塞/风险：无。

## 2026-02-20
- 完成：接入 pre-commit 五项门禁（`gitleaks`、`shellcheck`、`go vet`、`golangci-lint`、`yamllint`），并按“增量优先”策略实现（Web 仅暂存文件、Go 仅有 Go 变更触发、YAML 仅暂存 YAML 触发）。
- 完成：新增 `scripts/qa/go-vet.sh`、`scripts/qa/golangci-lint.sh`、`scripts/qa/yamllint.sh`，并同步更新 `scripts/git-hooks/pre-commit.sh`、`scripts/qa/secrets.sh`、`scripts/doctor.sh`、`scripts/setup-git-hooks.sh` 与 README 文档。
- 验证：三个仓库均执行新增脚本；`go-vet` 通过，`golangci-lint` 与 `yamllint` 在现有历史代码/配置基线上报出问题（符合预期，未做历史问题清理）。
- 下一步：如需让 pre-commit 在现状下可顺畅通过，需要先清理历史 `golangci-lint`/`yamllint` 存量问题或按仓库基线配置忽略策略。
- 阻塞/风险：当前若提交涉及 Go/YAML 改动，pre-commit 可能被历史问题阻断。

## 2026-02-20
- 完成：将 `scripts/git-hooks/pre-push.sh` 调整为更严格模式：先执行 `scripts/qa/shellcheck.sh`（`SHELLCHECK_STRICT=1`）再执行 `scripts/qa/full.sh`（`SECRETS_STRICT=1`）。
- 完成：同步更新 `README.md` 与 `scripts/README.md` 的 pre-push 说明，确保文档与实际门禁策略一致。
- 验证：执行 `bash scripts/git-hooks/pre-push.sh` 通过，且 `qa:shellcheck`、`qa:secrets` 均按阻断模式执行。
- 下一步：继续保持“日常走 full、发版前走 strict”的执行节奏。
- 阻塞/风险：无。

## 2026-02-20
- 完成：删除 `scripts/sync-quality.sh` 与 `scripts/sync-targets.txt.example`，避免对外交付代码时暴露跨仓库同步上下文。
- 完成：清理 `README.md`、`scripts/README.md`、`scripts/setup-git-hooks.sh` 中与该脚本相关的命令入口和说明。
- 下一步：无。
- 阻塞/风险：无。

## 2026-02-20
- 完成：修复 `scripts/doctor.sh` 的 Node 版本提示变量展开边界问题，将提示行变量改为 `${...}` 显式包裹，避免在特定 shell/locale 下触发 `unbound variable`。
- 验证：构造版本不一致场景执行 `doctor.sh`，现可正常输出提示且不报错。
- 下一步：无。
- 阻塞/风险：无。

## 2026-02-20
- 完成：`scripts/sync-quality.sh` 通用化改造（不再写死仓库名，支持 `--apply`、`--all-siblings`、`scripts/sync-targets*.txt` 清单，默认 dry-run）。
- 完成：新增 `scripts/sync-targets.txt.example`，并在 `README`/`scripts/README` 补充用法说明；脚本改为 Bash 3 兼容实现。
- 下一步：如需长期固定目标，可在本地维护 `scripts/sync-targets.local.txt`。
- 阻塞/风险：无。

## 2026-02-20
- 完成：按 `n` 使用习惯将版本锁定切换为 `.n-node-version`（移除 `.nvmrc`），并调整 `doctor`/脚本文档说明为 `n auto` 工作流。
- 完成：`scripts/doctor.sh` 改为按优先级读取 `.n-node-version`、`.node-version`、`.nvmrc` 进行 Node 版本提示。
- 下一步：本地执行 `n auto` 后再跑 QA 脚本，保持 Node 版本一致。
- 阻塞/风险：无。

## 2026-02-20
- 完成：新增本地质量脚本 `scripts/doctor.sh`、`scripts/qa/strict.sh`、`scripts/qa/shellcheck.sh`、`scripts/sync-quality.sh`，并新增 `.nvmrc`（Node 版本锁定）。
- 完成：更新 `scripts/setup-git-hooks.sh`，纳入新增脚本可执行权限；更新 `scripts/README.md` 与根 `README.md` 使用说明。
- 验证：执行脚本语法检查、`doctor` 检查、`--help` 冒烟通过。
- 下一步：如需启用强安全策略，可安装 `gitleaks/shellcheck` 并在关键流程启用 `strict`。
- 阻塞/风险：当前环境未安装 `gitleaks` 与 `shellcheck`，对应检查为提示模式。

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

## 2026-02-20
- 完成：新增 `scripts/qa/shfmt.sh` 与 `scripts/qa/govulncheck.sh`，并接入到三处流程：`pre-commit`（staged shell 自动 `shfmt`）、`full`（govulncheck 提示模式）、`strict`（`shfmt` 检查模式 + `govulncheck` 阻断模式）。
- 完成：更新 `scripts/doctor.sh`、`scripts/setup-git-hooks.sh`、`scripts/README.md`、根 `README.md`，同步补齐工具说明与门禁行为。
- 验证：已安装 `shfmt v3.12.0`、`govulncheck v1.1.4`；执行 `scripts/qa/shfmt.sh`、`scripts/qa/govulncheck.sh`、`scripts/doctor.sh`、`scripts/git-hooks/pre-push.sh` 通过。
- 验证：`scripts/qa/strict.sh` 当前被历史漏洞基线拦截（`go.opentelemetry.io/otel/sdk@v1.38.0` -> `>=v1.40.0`，`github.com/golang-jwt/jwt/v5@v5.1.0` -> `>=v5.2.2`）。
- 下一步：按目录分批修复并升级上述依赖版本，清理后再把 `strict` 设为日常阻断。
- 阻塞/风险：严格模式暂不可全绿，阻塞点为既有依赖漏洞基线。

## 2026-02-20
- 完成：修复 `govulncheck` 阻断基线，升级 `server/go.mod` 依赖：`go.opentelemetry.io/otel/sdk` 到 `v1.40.0`、`github.com/golang-jwt/jwt/v5` 到 `v5.2.2`（并同步相关 OTel 子模块版本）。
- 验证：`bash scripts/qa/strict.sh` 已全通过；`bash scripts/git-hooks/pre-push.sh` 已全通过。
- 下一步：继续按目录分批清理历史质量问题，优先做与业务改动同目录的小批次。
- 阻塞/风险：无。

## 2026-02-20
- 完成：按三仓库同步审计结果新增根级 `.gitignore`，统一忽略项（`.cursor`、`.DS_Store`、`web/node_modules`、`web/build`、`server/bin`、`output/`、`.playwright-cli/`）。
- 下一步：如后续新增工具缓存目录（如 coverage/sbom 报告目录），继续三仓库同批补充忽略规则。
- 阻塞/风险：无。

## 2026-03-02
- 完成：新增本地一键发布脚本 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh`，串联 `make build_server`、`docker save`、`rsync` 与远端 `deploy_server.sh`；脚本已改为通过环境变量显式指定目标主机。
- 完成：发布脚本新增 `AUTO_SMOKE` 部署后自动检查（`off/basic/auto/strict`），默认 `auto` 按最近改动路径自动判定；命中后端关键目录（`server/internal`、`server/cmd`、`server/configs`、迁移目录等）自动走 `strict`。
- 完成：检查项包含 `healthz/readyz`、远端容器状态；`strict` 模式额外检查首页可达性并扫描容器日志 `panic/fatal`。
- 完成：同步更新部署文档 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md`，补齐一键发布命令、环境变量与自动检查策略说明。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 通过；`publish_server.sh --help` 输出正常且包含新增参数。
- 下一步：在目标服务器执行一次 `sh /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 实机验证，确认自动判定与健康检查结果符合预期。
- 阻塞/风险：`publish_server.sh` 默认 `IMAGE_NAME=simulator-server:dev`（与当前 `server/Makefile` 产物一致）；若后续镜像名切换为 `template-server:*`，需同步覆盖 `IMAGE_NAME` 或调整 Makefile。

## 2026-03-02
- 完成：修正跨项目部署混淆风险：`publish_server.sh` 改为默认上传到项目独立远端目录 `~/deploy/webapp-template`，并使用项目专属远端脚本名 `deploy_webapp_template_server.sh` 与专属 compose 文件名 `compose.webapp-template.yml`。
- 完成：发布流程新增“上传 deploy_server.sh + compose.yml”步骤，再以 `COMPOSE_FILE=./compose.webapp-template.yml` 执行远端部署，避免复用 `~/deploy_server.sh` 与 `~/compose.yml` 引发串项目。
- 完成：同步更新部署文档 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md`，明确新的远端默认路径、脚本名和 compose 文件名。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 通过；`publish_server.sh --help` 输出已更新隔离参数说明。
- 下一步：在目标服务器首次执行发布前，建议确认远端目录 `~/deploy/webapp-template` 对应 `.env` 配置（若依赖自定义变量）。
- 阻塞/风险：若远端原有部署依赖 `~/.env` 或 `~/compose.yml`，迁移到独立目录后需同步放置项目级 `.env`，否则将回退到 compose 默认值。

## 2026-03-03
- 完成：完善发布脚本首发稳定性：在 `publish_server.sh` 中将远端目录创建前置到镜像上传前（`ssh mkdir -p` 先执行，再 `rsync` 镜像），避免首次部署时因目标目录不存在导致上传失败。
- 完成：保持与 `collision-simulator`、`trade-erp` 发布流程一致，三仓库发布链路已统一为“先建目录 -> 传镜像 -> 传脚本/compose -> 远端执行 -> 自动检查”。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 通过；`publish_server.sh --help` 输出正常。
- 下一步：建议在新机器首次部署时直接执行一遍发布脚本，验证目录自动创建与镜像上传链路。
- 阻塞/风险：无。

## 2026-03-03
- 完成：部署拓扑去耦：`server/deploy/compose/prod/compose.yml` 移除外部共享网络依赖，不再引用 `collision-simulator_default`；`mysql/jaeger` 容器名改为 `webapp-template-*` 前缀。
- 完成：默认运行参数改为项目专属：镜像默认 `webapp-template-server:dev`，MySQL 数据目录默认 `/data/webapp-template/mysql/*`，并将 MySQL/Jaeger 默认映射端口调整为与其他项目不冲突。
- 完成：`deploy_server.sh` 删除共享网络自动识别与补挂逻辑，仅保留本项目容器重建；`migrate_online.sh` 删除跨项目 MySQL 容器兜底匹配，只按当前 compose 服务解析。
- 完成：同步更新 `server/Makefile`、`publish_server.sh`、`server/deploy/compose/prod/.env.example` 与 `README.md`，确保脚本、默认值、文档口径一致。
- 验证：`sh -n server/deploy/compose/prod/deploy_server.sh`、`sh -n server/deploy/compose/prod/publish_server.sh`、`sh -n server/deploy/compose/prod/migrate_online.sh` 通过；`docker compose -f server/deploy/compose/prod/compose.yml config` 通过。
- 下一步：远端切换时先执行一次 `docker compose -f compose.webapp-template.yml up -d` 全量拉起（含 MySQL/Jaeger），确认新容器名与端口生效后再执行增量发布。
- 阻塞/风险：若远端已有旧版 `mysql8/jaeger` 或旧端口占用，首次切换可能冲突，需要先停掉旧容器或改用自定义 `.env` 端口。

## 2026-03-03
- 完成：按低资源主机要求下调默认内存上限（`server/deploy/compose/prod/compose.yml`）：`webapp-template-mysql` 从 `2g/1g` 下调为 `512m/256m`，`webapp-template-jaeger` 新增 `192m/96m` 限制，`webapp-template-server` 从 `1g/512m` 下调为 `128m/64m`。
- 完成：线上运行态按共享依赖策略执行限额，`webapp-template-server` 在线下发为 `128m/64m` 且保持 `restart=no`，避免主机重启后批量自启雪崩。
- 验证：远端 `http://127.0.0.1:8200/healthz` 返回 `200`；`docker stats` 观察 `webapp-template-server` 内存约 `25MiB/128MiB`，稳定运行。
- 下一步：若后续出现峰值 OOM，再把 `webapp-template-server` 提升到 `160m/80m` 并复测。
- 阻塞/风险：若误执行 `docker compose up -d` 全量拉起本项目 mysql/jaeger，会额外占用内存；当前建议继续复用 collision-simulator 的共享依赖。

## 2026-03-03
- 完成：清理跨项目服务标识残留，将 `server/cmd/server/main.go` 的 `Name/TraceName` 从 `simulator-server*` 改为 `webapp-template-server*`，避免与其他项目日志和链路追踪混淆。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./cmd/server` 通过；`rg -n --hidden -g '!**/.git/**' -g '!progress.md' -e 'collision-simulator|trade-erp|simulator-server' /Users/simon/projects/webapp-template` 结果为空。
- 下一步：如需历史文档完全无跨项目字样，可再单独清理 `progress.md` 历史记录。
- 阻塞/风险：无。
## 2026-03-16
- 完成：将仓库根 `.gitignore` 补齐 `web/.vite-cache/`，并沿用既有 `server/.gitignore` 对 `configs/dev/config.local.yaml` 的忽略规则，避免模板仓库继续提交前端缓存与本地私有 dev 配置。
- 完成：把 `/Users/simon/projects/webapp-template/server/configs/dev/config.yaml` 收口为“公开基线配置”：共享 trace/PG/redis 示例地址统一改为 `192.168.0.106`，数据库连接示例改成 `postgres://test_user:replace-me@192.168.0.106:5432/test_database_atlas?...`，移除真实密码、JWT、管理员密码和 Telegram token，改为占位值并在注释里明确要求走 `POSTGRES_DSN`、`TRACE_ENDPOINT` 或 `config.local.yaml` 覆盖。
- 完成：保留既有 `config.local.yaml + POSTGRES_DSN/TRACE_ENDPOINT` 启动兜底链路，并把 `Makefile` 中 Atlas 迁移的 DB_URL 示例同步改成 `192.168.0.106` 的公开示例，避免模板继续输出 `127.0.0.1` 的旧联调口径。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./cmd/server`；`git -C /Users/simon/projects/webapp-template check-ignore -v web/.vite-cache server/configs/dev/config.local.yaml`；`rg -n "127\\.0\\.0\\.1:4318|postgres://[^\\n]*127\\.0\\.0\\.1" /Users/simon/projects/collision-simulator /Users/simon/projects/trade-erp /Users/simon/projects/webapp-template -g '!**/.git/**'`。
- 下一步：若要让派生项目初始化更顺手，可在模板 README 或 `scripts/init-project.sh` 里补一段 “如何创建 `config.local.yaml`” 的引导。
- 阻塞/风险：模板仓库当前只提供公开基线示例，不包含任何可直接连库的真实 dev 凭据；派生项目初始化后仍需团队自行准备本地覆盖文件或环境变量。


## 2026-03-03
- 完成：清理 `server/api/jsonrpc/v1/jsonrpc.proto` 中易引起跨项目误解的示例注释，将 `collision.*` 示例替换为 `erp.*` 示例，并重新生成对应产物（`jsonrpc.pb.go`、`jsonrpc_grpc.pb.go`、`jsonrpc_http.pb.go`、`jsonrpc.swagger.json`），确保源文件与生成文件口径一致。
- 验证：`rg -n --hidden -g '!**/.git/**' 'collision\\.|\\bcollision\\b|colli' /Users/simon/projects/webapp-template/server/api/jsonrpc/v1` 结果为空。
- 下一步：如需彻底消除历史语义歧义，可进一步把 `erp.*` 改为中性 `domain.*` 示例（仅文案层变更）。
- 阻塞/风险：无。

## 2026-03-07
- 完成：移除前端目录下已不再使用的 `/Users/simon/projects/webapp-template/web/nginx.conf`，避免仓库继续保留无实际消费方的 Nginx 配置。
- 完成：新增 `/Users/simon/projects/webapp-template/web/.dockerignore`，排除宿主机 `node_modules` 与本地产物，修复 `web/Dockerfile` 在 `COPY . .` 时覆盖容器依赖目录的问题。
- 完成：回归验证 `docker build -f /Users/simon/projects/webapp-template/web/Dockerfile -t webapp-template-web-no-nginx-verify /Users/simon/projects/webapp-template/web` 通过，确认移除 Nginx 配置后前端仍可稳定产出构建结果。
- 下一步：若后续希望规范跨项目前端构建链路，可把同类 `.dockerignore` 模板下沉为统一脚手架约定。
- 阻塞/风险：当前前端 Dockerfile 为纯构建镜像，不再承诺容器内直接提供静态站点服务；若未来需要单独运行前端容器，需补新的运行时镜像方案。

## 2026-03-07
- 完成：将 `/Users/simon/projects/webapp-template/server/Dockerfile` 的平台声明从硬编码 `linux/amd64` 收口为“构建阶段跟随 `BUILDPLATFORM`、运行阶段默认 `RUNTIMEPLATFORM=linux/amd64`、Go 目标架构独立显式控制”的写法，消除 Docker `--platform` 常量告警，同时保持现有 amd64 产物口径不变。
- 完成：回归验证 `docker build -f /Users/simon/projects/webapp-template/server/Dockerfile -t webapp-template-server-platform-clean-final /Users/simon/projects/webapp-template` 通过，未再出现 `FromPlatformFlagConstDisallowed` / `RedundantTargetPlatform` 告警。
- 下一步：若后续确需支持 arm64 产物，可在构建入口统一覆盖 `RUNTIMEPLATFORM`、`GO_TARGETOS`、`GO_TARGETARCH`，避免各项目手工分散修改。
- 阻塞/风险：当前构建日志仍会出现 `go mod download && go mod tidy` 阶段的 `go: warning: "all" matched no packages` 提示，属既有构建顺序问题，不影响本次镜像产出。

## 2026-03-07
- 完成：将 `/Users/simon/projects/webapp-template/server/Dockerfile` 预热依赖阶段的 `go mod download && go mod tidy` 收口为仅执行 `go mod download`，去掉无源码上下文下的 `go: warning: "all" matched no packages` 构建提示。
- 完成：回归验证 `docker build -f /Users/simon/projects/webapp-template/server/Dockerfile -t webapp-template-server-no-tidy-warning-verify /Users/simon/projects/webapp-template` 通过，日志中不再出现该提示。
- 下一步：若后续要继续压缩构建日志噪音，可再评估是否把前端依赖安装阶段的 `npm notice` 与 `pnpm approve-builds` 提示一起处理。
- 阻塞/风险：当前镜像构建不再在 Docker 内执行 `go mod tidy`；如后续确需自动整理依赖，应放回开发脚本或 CI 校验，而不是运行时镜像构建阶段。

## 2026-03-07
- 完成：将 `/Users/simon/projects/webapp-template/web/Dockerfile` 与 `/Users/simon/projects/webapp-template/web/.dockerignore` 移入系统回收站，收口为仅通过 `/Users/simon/projects/webapp-template/server/Dockerfile` 一次性完成前端构建与服务端镜像打包，避免继续维护重复的独立前端 Docker 入口。
- 完成：复核仓库内正式文档与脚本入口，当前无额外 README/脚本依赖独立 `web/Dockerfile`；历史 `progress.md` 记录保留作为演进轨迹。
- 下一步：若后续需要统一团队构建口径，可在发版说明或部署手册中明确“以 `server/Dockerfile` 作为唯一镜像构建入口”。
- 阻塞/风险：独立前端镜像构建入口已移除；若外部仍有旧脚本直接调用 `/Users/simon/projects/webapp-template/web/Dockerfile`，需要同步切换到 `/Users/simon/projects/webapp-template/server/Dockerfile`。

## 2026-03-07
- 完成：为模板仓库新增统一错误码目录与唯一性校验，集中维护服务端对外错误码，并补充“仅登录态失效才触发重新登录”的分类函数，避免继续散落魔法数字或一码多义（`/Users/simon/projects/webapp-template/server/internal/errcode/catalog.go`、`/Users/simon/projects/webapp-template/server/internal/errcode/catalog_test.go`）。
- 完成：将 `/Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go` 改为引用统一错误码目录，修正历史语义冲突：`40302` 仅表示“未登录”，`40303` 仅表示“管理员已禁用”，`40304` 统一表示“权限不足”；同时把订阅类参数错误码从与用户管理冲突的 `40060~40064` 收口到独立段 `40080~40084`。
- 完成：新增前端错误码常量并改造公共错误处理，只在 `AUTH_REQUIRED / AUTH_EXPIRED / AUTH_INVALID` 时清 token 与跳登录，避免把权限不足误处理成登出（`/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js`、`/Users/simon/projects/webapp-template/web/src/common/utils/jsonRpc.js`、`/Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.js`）。
- 完成：新增错误码魔法数字守卫并接入 `fast/full/pre-commit`，同时把错误码治理约定补充到仓库说明，降低后续 AI/人工改动再次写散错误码的概率（`/Users/simon/projects/webapp-template/scripts/qa/error-codes.sh`、`/Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`/Users/simon/projects/webapp-template/scripts/qa/full.sh`、`/Users/simon/projects/webapp-template/scripts/git-hooks/pre-commit.sh`、`/Users/simon/projects/webapp-template/AGENTS.md`、`/Users/simon/projects/webapp-template/README.md`、`/Users/simon/projects/webapp-template/scripts/README.md`）。
- 验证：`bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh`；`cd /Users/simon/projects/webapp-template/server && go test ./internal/errcode ./internal/data`；`cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --no-warn-ignored src/common/consts/errorCodes.js src/common/utils/jsonRpc.js src/common/utils/errorMessage.js`；`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`；`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`。
- 下一步：建议后续新项目直接从本模板复制错误码目录、前端常量和 `error-codes` 守卫，把“错误码统一治理”作为默认脚手架能力保留下去。
- 阻塞/风险：`scripts/qa/full.sh` 过程中 `govulncheck` 仍提示当前 Go `1.26.0` 标准库漏洞告警（修复版本为 `1.26.1`），但该脚本当前默认仅提示不阻断；若要把模板质量门禁也收口为全绿，后续仍需单独升级模板 Go 工具链与 Docker 构建基线。

## 2026-03-20
- 完成：为服务端默认结构化日志新增 `trace_sampled` 与 `trace_link_id` 字段；其中 `trace_link_id` 只在当前 span 真正被采样时输出，避免低采样环境把未上报到 Jaeger 的 trace id 也暴露成可点击跳转（`/Users/simon/projects/webapp-template/server/pkg/logger/default.go`、`/Users/simon/projects/webapp-template/server/pkg/logger/default_test.go`）。
- 完成：将实验室 Grafana Loki datasource 的 `View trace` 规则从直接匹配 `trace.id/trace_id` 改为仅匹配 `trace_link_id`，并同步更新值班说明文案，明确只有 sampled 日志才会显示可跳转的 trace 链接（`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-loki-datasource.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/grafana-loki-datasource.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-overview-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/grafana-lab-overview-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-data-services-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/grafana-lab-data-services-dashboard.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`/Users/simon/projects/webapp-template/server/docs/observability.md`）。
- 完成：已将 `grafana-loki-datasource`、`grafana-lab-overview-dashboard`、`grafana-lab-data-services-dashboard` 三个 live ConfigMap 直接 `kubectl apply` 到实验室集群；随后确认集群内 `lab-ha-grafana-loki-datasource` 已切换为 `trace_link_id` 规则，Grafana sidecar 也在 `2026-03-20T15:27:42Z` 重写了 `loki-datasource.yaml` 与两个 dashboard 文件，说明 live Grafana 已收到这次变更。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./pkg/logger ./internal/server ./cmd/server`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-loki-datasource.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-overview-dashboard.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-data-services-dashboard.yaml`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get configmap -n monitoring lab-ha-grafana-loki-datasource -o jsonpath='{.data.loki-datasource\.yaml}'`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n monitoring kube-prometheus-stack-grafana-5c697fb66-sp2zx -c grafana-sc-datasources --tail=10`；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n monitoring kube-prometheus-stack-grafana-5c697fb66-sp2zx -c grafana-sc-dashboard --tail=40`。
- 下一步：如需把 `lab-platform` 全量纳入 Helm 真源，下一轮应先处理历史手工对象的 ownership 导入，再恢复 `ONLY=lab-platform bash .../helm-release.sh apply` 这条正式发布路径。
- 阻塞/风险：当前 live 生效是通过对单个 manifest 直接 `kubectl apply` 完成的；根因是 `lab-platform` release 尚未完成 Helm 接管，直接 `helm upgrade --install` 会先撞上现有 `lab-portal` Namespace 等历史对象的 ownership 冲突。
## 2026-03-21
- 完成：为实验室补齐“无命令版”的一键压测入口，并把 Portal 从纯导航页推进到“最近一次压测”聚合页。更新 `/Users/simon/projects/webapp-template/.gitlab-ci.yml`，新增 `loadtest` stage 与 `loadtest_lab` job：当手动运行 GitLab pipeline 且 `PIPELINE_MODE=loadtest` 时，Runner 会在实验环境内自动执行 `/Users/simon/projects/webapp-template/scripts/loadtest/run.sh`，默认目标是 `http://192.168.0.108:32668`、默认场景是安全的 `system`；同时把 `deploy_lab` 改成在 `PIPELINE_MODE=loadtest` 时跳过，避免“手动压测 pipeline”误触发布。为便于 Portal 聚合最近一次结果，`loadtest_lab` 现在会把每轮 job 的 `portal-summary.json`、`summary.json`、`report.html` 额外复制到固定 artifacts 路径 `server/deploy/lab-ha/artifacts/loadtest/job/`，并显式记录 `has_summary/has_report`，避免超短 smoke 时误给出 404 报告链接。Portal 侧继续更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`：新增 `Run Load Test` 卡片、`Latest Load Test` 动态状态卡，以及 `/gitlab-api/`、`/gitlab/` 同源代理，通过浏览器已有的 GitLab 登录态读取最近一次 `loadtest_lab` 的 job 状态与摘要；文档侧同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/LOAD_TEST.md`、`/Users/simon/projects/webapp-template/scripts/loadtest/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，把 Portal 聚合入口、固定 artifacts 路径与短压测报告边界写成统一口径。
- 验证：人工复核 `.gitlab-ci.yml` 规则后，`loadtest_lab` 仅在 `PIPELINE_MODE=loadtest` 时出现并运行，`deploy_lab` 会在同一模式下跳过；`ruby -e 'require "yaml"; YAML.load_file(...)'` 已通过 `.gitlab-ci.yml`、`platform-portal.yaml` 与 raw 副本校验，`bash /Users/simon/projects/webapp-template/scripts/qa/yamllint.sh` 已通过；`ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 已把 Portal raw 副本同步到最新真源；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 与 `rollout restart deployment/lab-portal -n lab-portal` 后，`curl --noproxy '*' -fsS http://192.168.0.108:30088` 已能回读到新的 `Latest Load Test` 区块、动态按钮 id 与 GitLab 一键入口；Playwright 复核显示 GitLab `Run pipeline` 页面会预填 `PIPELINE_MODE=loadtest` 与 `LOADTEST_SCENARIO=system`，Portal 在当前浏览器已登录 GitLab 的前提下会把“最近一次压测”卡从初始 `加载中` 收口成 `尚未运行`，说明同源代理与私有项目 `project_id=1` 取数链路已经打通。另做了一轮本地低风险 `health` smoke，确认 `K6_WEB_DASHBOARD=true` 时 `summary.json` 仍能正常导出；同时也观察到几秒级超短测试会被 `k6` 直接跳过 HTML 报告导出，这也是本轮补 `has_report` 标记的原因。提交 `0714212`、`d7f33ba`、`3bfba5d` 已推送到 `origin` 与 `gitlab`，随后连续手动触发了 GitLab `Pipeline #26`、`#28`、`#30`：第 1 轮确认远端已经真正带出 `validate_lab + loadtest_lab` 两个 job，但 `job #42` 暴露 `.gitlab-ci.yml` 里 YAML folded block 把 `if ... then` 折成了一行，报 `bash: eval: line 186: syntax error near unexpected token 'then'`；第 2 轮修复该问题后，`job #46` 又继续暴露现场 Runner 环境事实：当前 `lab-shell-runner` 只有 shell，没有本机 `k6`，也没有 `docker`，因此 `scripts/loadtest/run.sh` 在 Docker fallback 处直接报 `docker: command not found`；第 3 轮继续证明 shell runner 上连 `go` 也不存在，`job #50` 只能走到“缺少 k6 / Docker / go-install 兜底，无法运行压测”。为消除这类环境耦合，现已把 `run.sh` 的兜底顺序进一步收口成：本机 `k6` -> 下载固定版本 k6 二进制 -> `go install` -> Docker；同时把 `scripts/loadtest` 里的可选链、对象展开与 `Object.fromEntries` 等更偏新的语法收敛到更保守的写法，避免 shell runner 上的旧编译路径再炸。最新本地模拟结果是：在“只有 go、没有 docker/k6”的 PATH 下，`bash scripts/loadtest/run.sh health --vus 1 --duration 3s` 已能成功跑通并产出 `summary.json`；在“只有 curl/tar、没有 go/docker/k6”的 PATH 下，也已确认 `linux/amd64` 下载 URL 能成功命中，说明 shell runner 只要具备基础下载能力，就不再依赖宿主机预装 k6/docker。
- 下一步：把 `run.sh` 的“下载固定版本 k6 二进制”兜底和文档更新提交推送，再重跑默认 `system` 压测；如果第 4 轮 live pipeline 成功，就回看 `job/portal-summary.json`、固定 `summary.json/report.html` 路径和 Portal 首页动态卡，确认能从 `尚未运行` 切到真实的 `通过/失败` 结果；之后再补 Prometheus remote write 或其他接收端，把压测结果从 GitLab artifacts 继续沉淀到 `192.168.0.108:30081` 的 Grafana `Load Test` dashboard。
- 阻塞/风险：当前“一键压测”仍然依赖 GitLab 页面上的 `Run pipeline` 按钮，Portal 只是预填变量的跳转入口和结果聚合层，不是直接执行器；远端仓库与 Portal 页面已经同步到新提交，但 live pipeline 先后暴露了 YAML 折行、Runner 缺少 Docker/k6、Runner 缺少 go 三类真实运行环境问题，说明这条链路必须继续做真实回归，不能只看静态页面、YAML lint 或本机 smoke；另外现有 Prometheus 还没开 remote write receiver，所以压测结果目前先收敛在 GitLab artifacts，而不是 Grafana 实时看板。

## 2026-03-22
- 完成：按实验室“轻治理优先”的口径补了第一批服务治理基线：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/metrics-server-values.yaml` 并把 `metrics-server` 接入 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，同时给 `ingress-nginx` 打开 `ServiceMonitor`，让 `Metrics API` 与 `nginx_ingress_controller_*` 指标都进入统一真源；为避免本机残留的无关 Helm repo 把发布链路拖死，`helm-release.sh` 的 repo update 也收口成只更新 `lab-ha` 实际依赖的仓库。
- 完成：给 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template` 补齐 HPA 真源与 values：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/templates/hpa.yaml`，`lab` 命名空间默认 `2~6` 副本、`prod-trial` 默认 `2~4` 副本，并同时按 CPU `70%` / 内存 `80%` 做扩缩容；`prod-trial` 的 HPA 目标已收口为真实的 `Rollout`，不是挂在不存在的 `Deployment` 上。同步为 `lab/prod-trial` Ingress 增加基础限流与超时注解，为 `NetworkPolicy` 收紧到“允许 ingress-nginx namespace + 节点侧健康检查来源”。
- 完成：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-service-governance-dashboard.yaml`，并通过 `lab-platform` 真源接到 Grafana，统一展示 `HPA`、副本数、`Ingress 429/RPS/p95`、`PDB disruptions allowed`、Pod CPU/内存、重启次数，以及 `Argo Rollouts controller` 就绪状态；Portal 也新增了“服务治理”卡片，直达 `http://192.168.0.108:30081/d/lab-ha-service-governance/ha-lab-service-governance`。文档侧同步更新了 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/docs/deployment-conventions.md`。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`、`helm template .../charts/webapp-template -f values-lab.yaml`、`helm template .../charts/webapp-template -f values-prod-trial.yaml`、`kubectl --dry-run=server` 全部通过；live 侧已执行 `SKIP_REPO_UPDATE=1 ONLY=metrics-server bash .../helm-release.sh apply`、`SKIP_REPO_UPDATE=1 ONLY=ingress-nginx bash .../helm-release.sh apply`，并将 `lab-platform` 与 `webapp` 新渲染结果回收到集群。随后确认 `kubectl top nodes/pods` 已恢复可用，`kubectl get hpa -A` 能看到 `webapp-template` 和 `webapp-template-prod-trial`，其中 `prod-trial` 已显示为 `Rollout/webapp-template-prod-trial`；Prometheus 已能查询到 `nginx_ingress_controller_requests` 与 `nginx_ingress_controller_request_duration_seconds_bucket`；Playwright 已验证 Portal 首页出现新的“服务治理”卡片，Grafana 新看板可打开并显示 `WebApp Available Replicas=2`、`Prod Trial Available Replicas=2`、`HPA Desired Replicas=4`、`PDB Disruptions Allowed=4`、`Rollouts Controller Ready=1`，且 `Ingress 429 RPS` 在无命中时显示 `0 req/s` 而不是 `No data`。
- 下一步：若要继续把“服务治理”从基线推进到发布治理，应在下一轮把 `lab` 主应用也按需切到 `Rollout` 或明确保持 `Deployment`，并给新看板补一到两条告警规则（如 `HPA 到顶`、`Ingress 429 持续抬升`、`PDB disruption budget=0`）；如果要继续做更严格的网络治理，可再基于 Hubble 现场流量补更细的 `NetworkPolicy` 来源白名单，而不是直接引入 Istio/Sentinel。
- 阻塞/风险：`lab-platform` 仍有历史 Helm ownership 冲突，当前这轮 live 收口依然需要对渲染结果 `kubectl apply`，还没有完全回到 `ONLY=lab-platform bash .../helm-release.sh apply` 的单入口；另外 `prod-trial` 的 `webapp-trial*.nip.io` 入口在当前机器上如果不带 `--noproxy '*'`，仍可能因为本地代理链路返回 `502`，但在集群内回环请求和 `curl --noproxy '*'` 下都已验证为 `200`，说明这不是这轮治理改动引入的集群内故障，而是既有的客户端访问环境限制。

## 2026-03-22
- 完成：继续把服务治理从“能看”推进到“能告警”，新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/prometheus-rule-service-governance.yaml`，并通过 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 同步进 `lab-platform` 原始清单，统一定义了四条实验室治理告警：`LabWebappHpaAtMax`、`LabWebappPdbBudgetExhausted`、`LabIngress429High`、`LabIngressP95LatencyHigh`。这些规则都直接回链到现有 `Service Governance` 看板、`Alertmanager` 和值班文档，不再额外引入新告警通道。
- 完成：把 `PrometheusRule` 的 live 落地继续保持在当前 `lab-platform` 收口路径：先执行 `ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 让 raw 副本与渲染产物同步，再对 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 执行 `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply`。同时更新了 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，把服务治理告警清单纳入目录说明。
- 验证：`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 通过；live apply 后 `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring get prometheusrule lab-service-governance -o yaml` 可见 `prometheus-operator-validated: "true"`；Prometheus rulefile ConfigMap 中已经生成 `monitoring-lab-service-governance-*.yaml`；`curl -s http://192.168.0.108:30090/api/v1/rules` 已能回读到 `lab.service-governance` 组，四条规则均为 `health=ok / state=inactive`，说明规则加载成功且当前无误报。
- 下一步：若要继续提升值班闭环，建议下一轮基于现有告警再补两件事：一是给 `Service Governance` 看板补对应告警状态面板，二是挑一条低风险规则做受控演练（例如压测触发 `Ingress 429`），确认 `Alertmanager -> webhook -> Portal/Grafana` 的实际值班体验。
- 阻塞/风险：本机默认 `kubectl` 当前上下文是 `orbstack`，不是实验室集群；这轮已明确改用 `--kubeconfig /Users/simon/.kube/ha-lab.conf` 才避免把 dry-run 和 live apply 打到错误集群。后续凡是 `lab-ha` 相关的集群操作都应沿用这条显式 kubeconfig 口径。

## 2026-03-23
- 完成：继续收口服务治理告警的真实演练链路，先修正 live 漂移，再做低风险 `429` 受控演练。源码侧更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/ingress-nginx-values.yaml`，显式把 `ingress-nginx` 的 `limit-req-status-code` / `limit-conn-status-code` 统一设为 `429`，避免默认 `503` 让治理看板和告警口径失真；文档侧同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`。live 侧重新按当前 chart 渲染并 apply 了 `webapp` / `webapp-prod-trial` 清单，补回原本应该存在但现场缺失的 Ingress 限流注解，随后对 `ingress-nginx` 执行 `ONLY=ingress-nginx ... helm-release.sh apply` 使控制器配置生效。
- 完成：做了一轮低风险真实演练。为了避免用高强度压测长时间顶住小规格实验环境，先临时把 `webapp` Ingress 的 `limit-rps` 从 `60` 下调到 `5`、`limit-burst-multiplier` 从 `5` 下调到 `1`，然后连续约 `12` 分钟每 `20s` 发送一小批 `120` 个请求；每批稳定得到约 `106~108` 个 `429`。演练结束后，已把 Ingress 限流值恢复回 `60 / 5`。
- 验证：live 回读确认 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-lab.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial.yaml` 里的限流注解已经真正出现在 `webapp-template` 与 `webapp-template-prod-trial` Ingress 上；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n ingress-nginx get configmap ingress-nginx-controller` 已确认 `429 / 429` 生效。演练期间 Prometheus `status=\"429\"` 时序已出现，`LabIngress429High` 先进入 `pending`，随后在 `2026-03-22T17:29:54Z` 进入 `firing`；Alertmanager API 同期可见该告警处于 `active`，`alert-webhook-receiver` 日志也记录了来自 `Alertmanager/0.28.1` 的 `POST /`。恢复原限流后，`sum(rate(...status=\"429\"[5m]))` 已回落到 `0`，Alertmanager 中该告警消失，Prometheus 规则状态也已回到 `inactive`。
- 完成：继续把值班入口往 Grafana 收口，更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-service-governance-dashboard.yaml`，新增 `Firing Governance Alerts`、`Pending Governance Alerts` 与 `Current Governance Alerts` 三个 panel，并把说明区下移，保持现有时序图不变；随后重新渲染并 apply `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml`。K8s ConfigMap 已更新，Grafana API `/api/dashboards/uid/lab-ha-service-governance` 回读版本为 `4`，且已包含这三个新 panel 标题，说明不是只有 ConfigMap 变了，而是 dashboard 真正进入了 Grafana 当前版本。
- 完成：将 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/alert-webhook-receiver.yaml` 从只会回显请求的 `echoserver` 收口成轻量告警收件页：新增内嵌 Python `ConfigMap` 应用，提供 `/` 在线页面、`/api/alerts`、`/api/alerts/latest`、`/healthz`、`/readyz`，并把最近 `200` 条 webhook payload 缓存在 Pod 内存与 `/data/alerts.jsonl`。同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，把 `Alert Sink` 明确成“最近 webhook payload 收件页”，不再只说是 smoke test receiver。
- 验证：`yamllint`、`python3 -m py_compile`、`ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template`、`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/helm-rendered/lab-platform.yaml` 均通过。由于 `lab-platform` 仍存在 Helm ownership 冲突，live 侧继续按当前值班口径执行 `kubectl apply -f .../lab-platform.yaml`，随后重启 `/Users/simon/projects/webapp-template/server/deploy/lab-ha` 对应的 `lab-portal` Deployment，并确认 `monitoring/alert-webhook-receiver` 已滚动到 `docker.m.daocloud.io/library/python:3.12-alpine`。最终在 `http://192.168.0.108:30086/` 实际打开到新页面，并用一条 `lab-alert-sink-smoke` 模拟 webhook 验证页面能展示最近 payload，`/api/alerts/latest` 也能回读这条样本。
- 完成：继续把 `lab-platform` 的发布真源收回 Helm 单入口。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，新增仅用于一次性迁移的 `HELM_TAKE_OWNERSHIP=1` 开关，在 `apply` 时显式传给 Helm `--take-ownership`；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，明确这只是历史手工对象接管时使用的迁移参数，不应变成日常发布默认值。live 侧随后执行 `HELM_TAKE_OWNERSHIP=1 SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply`，已成功创建 `lab-platform` release；再执行一轮不带该开关的普通 `SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply`，确认后续发布已回到标准 Helm 升级路径。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 通过；`helm --kubeconfig /Users/simon/.kube/ha-lab.conf list -A` 已出现 `lab-platform / lab-system / deployed / revision 2`；`Namespace/lab-portal` 与 `Deployment/alert-webhook-receiver` 的 metadata 已回读到 `app.kubernetes.io/managed-by=Helm`、`meta.helm.sh/release-name=lab-platform`、`meta.helm.sh/release-namespace=lab-system`。回归期间 `http://192.168.0.108:30086/api/alerts/latest` 已能返回真实 recent payload，Portal 首页也继续能打开，说明接管没有把现有平台入口打坏。
- 完成：继续把 `lab-platform` 从“名义上归 Helm”收口到 Helm v4 的稳定 server-side apply 路径。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，新增仅用于迁移旧 field manager 的 `HELM_FORCE_CONFLICTS=1` 开关，对应 Helm `--force-conflicts`；文档 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 也已同步说明“只在迁移旧 `kubectl-client-side-apply` 字段所有权时临时开启”。live 侧先用该开关完成一次冲突字段接管，再执行一轮完全不带迁移开关的普通 `SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply`，确认 `lab-platform` 已真正回到稳态 Helm 升级路径，而不是每次都需要带特殊参数。
- 完成：继续收口告警值班体验。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/alert-webhook-receiver.yaml`，为 `Alert Sink` 页面补了 `source_type/source_label` 分类、`source=alertmanager|smoke|manual` 过滤能力，以及“真实告警 / 手工样本”计数；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，新增 `最近真实告警` 卡片，并通过 `/alert-sink-api/` 同源代理只读取 `Alertmanager` 来源的最近一条真实 payload，不再把手工 smoke 样本混到 Portal 摘要里。期间还顺手修了一个现场小坑：`lab-portal` 若在 ConfigMap 更新前就先重启，会继续挂到旧版页面文件，所以这轮最终按“先 Helm apply，再单独 rollout restart”串行收口。
- 验证：`python3 -m py_compile` 与 `yamllint` 通过，`ONLY=lab-platform bash .../helm-release.sh template`、`kubectl --dry-run=server -f .../lab-platform.yaml` 通过；随后 `HELM_FORCE_CONFLICTS=1` 迁移成功，普通 `SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply` 也已成功到 `revision 6`。页面侧，`Alert Sink` 现在能把 `lab-alert-sink-smoke-2` 标成 `手工样本`，并统计 `真实告警=0 / 手工样本=1`；Portal 经串行重启后，`最近真实告警` 卡片已只显示 `Alertmanager` 来源的真实 payload，实测展示为 `KubeProxyDown · lab-webhook · 03/23 22:20`，没有把 smoke 样本混进去。Playwright 回读也确认 Portal 控制台已不再出现旧的 `alert-sink-api/alerts/latest?source=alertmanager` 404 噪音。
- 下一步：若要继续提升值班闭环，建议下一轮把 `Alert Sink` 页面里的最近事件同步接到 Portal 卡片或 Grafana 深链，再补一个更明确的“真实 Alertmanager payload / 手工 smoke payload”区分，避免后续值班把人工样本误当成真实告警。
- 阻塞/风险：这轮虽然已经把 `lab-platform` 主发布路径收回 Helm，但 `blackbox-exporter`、`harbor`、`kube-prometheus-stack` 这几个 release 当前在 `helm list -A` 中仍显示 `failed` 历史状态，说明平台层还有其他独立的 Helm 技术债未清；另一个边界是新的 `Alert Sink` 目前只把最近事件缓存在单 Pod 内存与 `emptyDir` 文件里，Pod 重建后历史会丢，它适合值班排障，不是长期告警归档系统。此外，Portal / Alert Sink 这类纯 ConfigMap 页面改动在当前清单形态下仍需“apply 后再 rollout restart”才能稳定切到新文件，尚未做到声明式自动滚动。

## 2026-03-24
- 完成：继续把“虚拟机级 HA”从口头承诺收口到仓库真源和真实演练。已更新 `/Users/simon/projects/webapp-template/AGENTS.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 与多份 runbook/README，明确当前 Ubuntu 节点基线必须满足：`swap` 持久关闭且 `/etc/fstab` 不再保留生效中的 swap 挂载，`ufw/firewalld` 彻底关闭，`SELinux` 对当前 Ubuntu 节点不适用但未来 RHEL 系需单独决策；同时把 `Longhorn autoSalvage / autoDeletePodWhenVolumeDetachedUnexpectedly / nodeDownPodDeletionPolicy` 纳入冷启动硬检查。
- 完成：补齐 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/app-pg-cluster.yaml`，把此前只存在于 live 集群的 `CloudNativePG app-pg` 集群正式收回仓库真源，并显式固化 `switchoverDelay=30`、`stopDelay=60`；同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，将该清单纳入 `lab-platform` 原始清单同步链路。随后已执行 `ONLY=lab-platform HELM_TAKE_OWNERSHIP=1 bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply`，确认 `lab-platform revision 16` 成功接管并发布。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/longhorn-values.yaml`，显式收口 `Longhorn` 冷启动相关默认值，并已执行 `ONLY=longhorn bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply` 让 live 与仓库一致。
- 完成：继续深挖全节点同时冷启动后 Longhorn 仍需人工 salvage 的原因。live 回读发现三台 Longhorn 节点都报 `Multipathd=False`，且三台 Ubuntu 节点的 `multipathd.service`、`multipathd.socket` 确实处于 `enabled + active`；基于 Longhorn 官方 KB，已把“Longhorn 节点必须持久关闭 multipathd”收进 `/Users/simon/projects/webapp-template/AGENTS.md`、`ha-node-bootstrap.sh`、`check-ha-lab-cold-start.sh` 与多份 runbook/README，并让冷启动检查额外校验 Longhorn 节点 `Multipathd` 条件与 `faulted` 卷。
- 完成：执行了真实“三节点顺序重启”与“两轮三节点同时重启/全量冷启动”演练。第一轮同时重启暴露出 `Longhorn` 多个 `RWO PVC` 在全节点重启后停在 `faulted/detached`、监控与 SeaweedFS 依赖卷长期卡住的问题；第二轮在新的节点/Longhorn/CNPG 基线下再次演练，最终 `check-ha-lab-cold-start.sh` 真正通过，但过程中仍然需要人工做两类收口：一是对 `faulted` 的 Longhorn 卷按最新健康 replica 执行最小 salvage，二是清理冷启动后残留的 `Unknown/Completed` 旧 Pod 让 controller 重新建 Pod。
- 完成：在三台 live 节点上实际执行了 `multipathd.service + multipathd.socket` 的 `disable --now + mask`，随后重启 `longhorn-manager` 并再次做真实“三节点同时重启”复验。复验中 `Longhorn` 节点条件已经从 `Multipathd=False` 恢复为 `True`，证明这条节点基线已经真正生效；但即便去掉 `multipathd`，全量冷启动后仍会出现一批 `Longhorn faulted` 卷，需要再次按“最新健康 replica 清空 failedAt”的最小 salvage 才能让冷启动检查最终通过。
- 完成：继续把剩余问题从“存储黑盒”收口成明确验收项。live 回读发现当前只有 `node2` 的 Longhorn 磁盘仍是 `Schedulable=True`，`node1/node3` 都因为 `storageReserved + storage-minimal-available-percentage=25` 被判定成不可继续放新副本；这解释了为什么 `app-pg-4` 一类卷虽然能先恢复挂载，但会长期停在 `degraded`。已同步更新 `check-ha-lab-cold-start.sh` 与 runbook/OPS 文档，要求默认 2 副本场景下至少保留 `2` 个可调度 Longhorn 节点，否则不算真正恢复完成。
- 完成：把 Longhorn 默认盘保留策略收回到更符合当前 `200Gi` VM 实验环境的口径。已将 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/longhorn-values.yaml` 的 `storageReservedPercentageForDefaultDisk` 从隐式默认 `30%` 收口到 `20%`，并在 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 新增现有 Longhorn Node CR 的对齐逻辑：`longhorn apply` 后会自动把 `/var/lib/longhorn` 默认盘的 `spec.disks.*.storageReserved` 同步到仓库口径，避免“新节点是 20%，老节点还停在 30%”。
- 完成：已把新的 `20%` 默认盘保留比例真正应用到 live；当前 `storage-reserved-percentage-for-default-disk=20`，三台 Longhorn Node CR 的 `/var/lib/longhorn` 默认盘 `storageReserved` 已统一收敛到 `41732235264`。live 回读确认 `node1/node2/node3` 当前都恢复为 `Schedulable=True`，不再只有单节点能继续调度新副本。
- 完成：修正 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 新增存储验收时的一个误报点。此前 `longhorn_schedulable_nodes` 直接用 `jsonpath` 读取 `diskStatus` 这个 map 结构，脚本会在 `storage ha baseline` 段提前退出；现已改为 `kubectl -o json + jq` 统计真实可调度磁盘数，并再次实跑验证通过。
- 完成：基于 `20%` 默认盘保留比例，又做了一轮真实“三节点同时重启/全量冷启动”复验。复验过程中，控制面先恢复到 `3/3 Ready`，Longhorn 三个默认盘始终保持 `Schedulable=True`，并且这次没有再出现需要人工 salvage 的 `faulted` 卷；中间虽然短暂出现多批 `Unknown/Terminating` 旧 Pod 与若干 `degraded/unknown` 卷，但在清理这些陈旧 Pod 对象后，卷状态自动继续收敛，最终 `longhorn_faulted_volumes=none`、`longhorn_degraded_volumes=none`、`longhorn_schedulable_nodes=3`。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 通过；`kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/app-pg-cluster.yaml` 通过；live 回读确认 `Longhorn` 设置为 `auto-salvage=true`、`auto-delete-pod-when-volume-detached-unexpectedly=true`、`node-down-pod-deletion-policy=delete-both-statefulset-and-deployment-pod`；第二轮同时重启长跑会话最终返回 `SIMULTANEOUS_REBOOT_RERUN_OK`；收尾后 `BackupStorageLocation default=Available`，`monitoring` 与 `object-storage` 关键 Pod 全部回到 `Running`。
- 验证：live 再次实跑 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 已通过，输出确认 `longhorn_faulted_volumes=none`、`longhorn_degraded_volumes=none`、`longhorn_schedulable_nodes=3`，并且 `Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD` 六个入口均返回 `200`。
- 验证：这轮新的真实同时重启后，`kubectl get pods -A` 在清理完 `Unknown/Terminating` 旧 Pod 后已无 `CrashLoopBackOff / Pending / Unknown / Terminating`；对外 `Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD` 六个入口最终再次全部返回 `200`。
- 完成：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/cleanup-stale-controlled-pods.sh`，把“全量冷启动后陈旧 `Unknown/Terminating` controller Pod 清理”收成可独立运行的安全脚本；它只处理有 controller owner、且已超过年龄阈值的陈旧对象，不会碰裸 Pod。`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 也已接入这条 helper：当节点都 `Ready` 后，如果只剩这类旧 Pod，会自动清理一次并等待控制器收敛，再重新判定集群是否真的仍有异常。
- 完成：补齐面向人的 K8s 可视化入口，但没有额外引入新的 Dashboard 产品。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`，在 Portal 里新增显式 `K8s Workloads` 卡片；同时将 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-service-governance-dashboard.yaml` 的看板标题改成 `HA Lab / K8s Workloads`，并同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`、`README.md`、`OPS_CHECKLIST.md`、`RECOVERY_RUNBOOK.md`、`TROUBLESHOOTING.md`，把这张 Grafana 看板正式定义为当前 `lab-ha` 的默认 K8s 工作负载视图。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/cleanup-stale-controlled-pods.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`、`yamllint /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/grafana-lab-service-governance-dashboard.yaml` 均通过；helper 当前 live 实跑返回 `stale_pod_candidates=0 / deleted_count=0`；冷启动验收脚本再次 live 通过。Portal live 页面已能直接回读到 `K8s Workloads` 卡片，Grafana live `lab-ha-grafana-service-governance` ConfigMap 也已更新到标题 `HA Lab / K8s Workloads`。
- 下一步：把“同时冷启动后的陈旧 `Unknown/Terminating` Pod 清理”继续下沉成更自动化的收口动作，并单独核查 Longhorn 中两个长期残留的 `detached/unknown` 历史旧卷是否还能完全回收，避免它们长期挂在 live 里制造噪音。
- 阻塞/风险：这轮 `20%` 调整已经明显改善了全量冷启动表现，至少把上轮的“人工 salvage faulted 卷”降成了“自动清理陈旧 Pod 后继续收敛”；但它仍然不是严格意义上的零人工，因为我还没有在新 helper 接入后再次做一轮真实“三节点同时重启”回归，且 live 中仍留有两个历史 `detached/unknown` 卷未回收。另一个现场尾巴是 `lab-platform` 这次 Helm 升级再次撞到旧的 `kubectl-client-side-apply` 字段冲突：Portal 与 K8s Workloads 看板的 live 内容已经通过 Helm 同步 / 直接 `kubectl apply` 生效，但 release 状态需要下一轮再完整收回到干净的 `deployed`。

## 2026-03-24
- 完成：在接入 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/cleanup-stale-controlled-pods.sh` 后，又做了一轮真实“三节点同时重启/全量冷启动”复验。该轮中控制面恢复到 `3/3 Ready` 后，冷启动验收脚本无需人工清理旧 Pod、无需人工 salvage 卷，最终由 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 自行通过，说明当前 VM 级 HA 主路径已经能在同时冷启动场景下自动收敛。
- 完成：收回了上一轮 `lab-platform` 的 Helm 尾巴；当前 `helm status lab-platform -n lab-system` 已恢复为 `STATUS: deployed / REVISION: 18`，Portal live 页面持续显示 `K8s Workloads` 卡片，Grafana live 看板标题保持为 `HA Lab / K8s Workloads`。
- 完成：已把 Longhorn 中两个长期残留的历史旧卷从 live 安全回收。`database/app-pg-1` 通过 `kubectl cnpg destroy app-pg 1 -n database` 走 CNPG 官方实例销毁入口回收；`monitoring/alertmanager-kube-prometheus-stack-alertmanager-db-alertmanager-kube-prometheus-stack-alertmanager-0` 则在确认当前 Alertmanager StatefulSet 已改用 `emptyDir` 后删除历史 PVC。回读确认对应 PV 与 Longhorn `Volume` 资源均已消失，live 不再残留这两个 `detached/unknown` 旧卷。
- 完成：继续把“同时冷启动通过”收口成值班可视化，而不是只留在 runbook。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/verify-ha-lab-drill.sh`，用于在真实故障演练后复跑统一验收，并把 `ha-drill` 摘要写入 Alert Sink 持久化目录；同时更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/OPS_CHECKLIST.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TEST_REPORT.md`，让 Portal 新增“最近 HA 演练”卡片，并把正式演练入口、当前结论与验收标准同步到文档真源。
- 完成：修复 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/write-lab-ops-summary.sh` 的 live 兼容性问题。原先依赖 `kubectl exec -i ... cat > file` 会在当前环境里把摘要 JSON 写成 `0` 字节文件，导致 `/api/ops/summaries` 直接漏掉 `cold-start / ha-drill`；现已改为先 `base64` 编码再在 Pod 内显式解码写盘，实测可稳定写回 JSON，不再出现空文件。
- 验证：真实同时重启后再次 live 实跑 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 通过，输出确认 `pods=no-critical-errors`、`longhorn_faulted_volumes=none`、`longhorn_degraded_volumes=none`、`longhorn_schedulable_nodes=3`、`Synced Healthy`、`default=Available`，并且 `Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD` 六个入口均返回 `200`。
- 验证：旧卷回收后再次 live 实跑 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 仍通过，`kubectl get pods -A` 当前无 `CrashLoopBackOff / Pending / Unknown / Terminating`，Longhorn 也无 `faulted / degraded / unknown` 卷残留。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/verify-ha-lab-drill.sh`、`yamllint /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml` 通过；live 回读 `http://192.168.0.108:30086/api/ops/summaries` 当前已包含 `backup / cold-start / ha-drill / smoke` 四类正式摘要，其中 `ha-drill` 为 `simultaneous reboot · nodes 3/3 · urls 6/6 · longhorn 3 schedulable`，`cold-start` 也已恢复为非空 JSON；Portal live ConfigMap 已可直接回读到 `Latest HA Drill / 最近 HA 演练 / ops-ha-drill-status / ops.action.openTestReport` 字样。
- 验证：继续排查 `lab-platform` 的 Helm 卡顿，已确认根因不在 `restart_lab_platform_runtime_deployments`：`monitoring/alert-webhook-receiver` 当前 `generation=10 / observedGeneration=10 / updatedReplicas=1 / availableReplicas=1`，`kubectl rollout status deployment/alert-webhook-receiver --timeout=15s` 直接成功；但 `helm` 侧最新 release secret `sh.helm.release.v1.lab-platform.v19` 状态为 `failed`。同一时间 `kubectl get --raw='/readyz?verbose'` 仍返回 `readyz check passed`，而 `kubectl get nodes`、`kubectl get pods -n kube-system -l component=kube-apiserver` 会在读取响应体阶段报 `request canceled / context deadline exceeded`，之后再查 release secret 还出现过 `TLS handshake timeout`，连三台节点的 `ssh` 也都超时。这说明当前 Helm apply“长时间无输出”的更直接原因是本机到控制面/API 的链路不稳定，而不是单纯 chart 模板或 rollout 逻辑卡死。
- 完成：继续把 Helm 卡顿从“终端现象”收口成脚本行为。更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，在 `apply` 前新增 API 稳定性预检：只有 `kubectl --disable-compression=true get --raw=/readyz` 和 `kubectl --disable-compression=true get nodes -o name` 连续成功，才允许继续跑 Helm；否则脚本会快速失败并明确报“当前运维机到 Kubernetes API 不稳定”。同时同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 通过。单独做的链路对照实验显示，当前从运维机侧访问 API server 的 TCP/HTTPS 基本连通，但 `kubectl get` 存在可重复复现的偶发超时；在同一轮测试里，`--disable-compression=true` 的 `kubectl get nodes -o name` 与 `kubectl get pods -n kube-system -l component=kube-apiserver -o name` 都是 `5/5` 成功，且整体延迟低于默认压缩链路，因此本轮预检也统一走了 `disable-compression` 口径。
- 下一步：继续观察是否还需要为值班补独立资源树式面板；在当前 `Portal + 最近 HA 演练 + K8s Workloads(Grafana) + Argo CD + Longhorn` 已能覆盖日常定位路径的前提下，`Headlamp` 不再是阻塞项。
- 阻塞/风险：这轮“完美通过”成立的边界仍然是当前三台 Ubuntu VM 与现有 Longhorn/Helm 基线，不等于硬件级 HA；另外，冷启动脚本里的陈旧 Pod helper 这次没有实际删除对象，说明集群已在等待窗口内自行收敛，但也意味着它还没覆盖所有 `kubectl get pods` 会显示成 `Unknown` 的旧对象形态，后续若再遇到更顽固的残留 Pod 仍需继续观察和收紧匹配条件。另一个现场尾巴是本轮 `lab-platform` 的完整 Helm apply 会话仍表现出“长时间无输出、人工取消”的异常，且最新证据更偏向“控制面/API 读响应与 SSH 链路偶发超时”，而不是 chart 真源本身；因此这次 Portal 页面更新虽然已经通过仓库真源 + live ConfigMap/rollout 生效，但 Helm 会话卡顿的根因仍值得后续单独追。新加的 API 预检只能让失败更快、更可解释，还没有消除控制面链路本身的抖动。

## 2026-03-24 16:47
- 完成：继续围绕 `lab-platform` 的 Helm 卡顿做根因定位。先从 `192.168.0.108` 进入 `etcd` 容器执行 `endpoint health/status --cluster`，确认三节点当前 `etcd` 健康、raft index 已对齐，leader 为 `192.168.0.108`，最近一次健康检查提交耗时大致为 `14ms / 58ms / 20ms`，说明控制面不是持续性失效，而是更像间歇性抖动窗口。
- 完成：从当前运维机再次做 10 轮 `kubectl get nodes -o name` 回归，结果 `10/10` 成功，单轮耗时约 `3.27s` 到 `8.31s`。随后重跑 `SKIP_REPO_UPDATE=1 ONLY=lab-platform bash .../helm-release.sh apply`，这次拿到了明确失败面：`helm upgrade --install lab-platform ...` 返回 `UPGRADE FAILED: create: failed to create: Timeout: request did not complete within requested timeout - context deadline exceeded`。这说明发布卡点已经从“静默现象”收口成“Helm 调 Kubernetes API 的写路径偶发超时”。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，让 `apply` 在每个 release 开始前显式打印 `Applying release ...`，并默认给 `helm upgrade --install` 增加 `--timeout 120s`；对应文档 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md` 也已同步补充 `HELM_TIMEOUT=<duration>` 说明。这样下次现场不会再只看到长时间无输出。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 通过。失败后再回读 live，`kubectl get pods -A` 里 `argocd / lab-portal / alert-webhook-receiver / prometheus / webapp` 相关 Pod 均仍为 `Running`；但同一时刻外部入口存在瞬时抖动：`Portal / WebApp / Grafana / Alertmanager` 返回 `200`，`Prometheus` 一度返回 `502`，`Argo CD` 一度出现 TLS EOF。同时，用 `kubectl --request-timeout=10s --disable-compression=true get secrets ...` 回读 `lab-platform` release 历史，仍能复现 `unexpected error when reading response body ... context deadline exceeded`，进一步说明不只是 Helm，当前运维机到 API server 的读写链路仍有偶发超时。
- 下一步：先不继续反复撞 `lab-platform` Helm apply，而是把根因继续往基础设施层收口，优先检查实验室 VM 宿主机或存储层是否存在瞬时 I/O / 网络抖动；在这条链路没稳定前，Helm 发布仍然可能偶发 `context deadline exceeded`。
- 阻塞/风险：`lab-platform` 最新成功 revision 仍是 `v18`，之后的 `v19` 和本轮重试都失败在 API 超时而不是 chart 真源错误；当前业务工作负载面总体仍在，但运维入口已出现瞬时 `502 / TLS EOF`，说明这不是“只影响发布”的孤立问题，而是控制面/API 或入口转发层仍存在抖动窗口。

## 2026-03-24 17:05
- 完成：继续把“控制面/API 间歇性超时”从现场观察收口成可复验脚本。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-node-pressure.sh`，统一通过 SSH 回读三台节点的 `load / memory / rootfs / vmstat(wa,st) / etcd 慢请求计数 / 内核 I/O 告警计数`，并在 `cpu steal >= 5%`、`iowait >= 5%`、`etcd_warn_count > 0`、`kernel_io_warn_count > 0` 时给出显式告警。这样后续再遇到 `kubectl` 或 `helm` 的 `context deadline exceeded`，不用再靠零散 SSH 临时拼判断。
- 完成：同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`，把这条诊断路径正式定义为“API/Helm 间歇性超时”的优先排查动作，并明确当前更像同宿主机 VM 的资源争用，而不是 `lab-platform` chart 真源持续损坏。
- 验证：实跑新脚本前的现场采样已经显示，三台节点当前 `etcd_warn_count=0`、近样本里没有新的 `kernel I/O` 硬错误，但 `192.168.0.108` 和 `192.168.0.128` 的 `vmstat/iostat` 都出现了接近 `10%` 的 `cpu steal`，同时伴随 `3%~4%` 的 `iowait`；这比单纯看 Pod 和 `/readyz` 更能解释“控制面整体还活着，但 Helm / kubectl 偶发超时”的形态。当前 6 个核心入口复查已经全部恢复 `200`。
- 下一步：若继续追根因，应转向 VM 宿主机层，检查宿主机 CPU overcommit、存储后端延迟和同宿主机其他负载；在这条基础设施问题没缓解前，不再把反复重试 Helm apply 当成有效修复手段。
- 阻塞/风险：这轮拿到的是从 VM 内部看到的侧证，还不是宿主机监控真源；因此可以合理怀疑“同宿主机资源争用”，但还不能仅凭来宾机数据就断言唯一根因。现阶段 `lab-platform` 发布写路径仍可能偶发 `context deadline exceeded`，只是它已经不再被误判成 chart 级问题。
- 完成：修正 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-node-pressure.sh` 的首轮 live 问题。远端 `bash -s` 现在改为显式参数传递，不再因为本地环境变量没有传过去而报 `VMSTAT_INTERVAL_SECONDS: unbound variable`；同时补入 `iostat avg-cpu` 采样，让脚本在 `vmstat` 之外也能直接抓到 `%steal / %iowait`。

## 2026-03-24 18:08
- 完成：补齐 Headlamp 真源。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/headlamp-values.yaml`，固定 Headlamp 官方 Helm chart `0.40.1`，走 `NodePort 30087`，并通过 `extraManifests` 预置 `headlamp/headlamp-admin` ServiceAccount 与 `cluster-admin` 绑定；同时新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh`，值班时可直接生成临时登录 token。
- 完成：更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`，把 `headlamp` 仓库与 release 纳入统一 Helm 入口；同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/platform-portal.yaml`、`charts/lab-platform/files/raw/platform-portal.yaml`、`docs/ACCESS.md`、`docs/OPS_CHECKLIST.md`、`docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/README.md`，让 Portal、访问文档和巡检清单都明确出现 `Headlamp` 入口与 token 登录说明。另新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/HIGH_PERFORMANCE_SERVER_BASELINE.md`，把未来迁移到高性能宿主机前的采购/验收基线独立成文。
- 完成：live 侧已执行 `SKIP_REPO_UPDATE=1 ONLY=headlamp bash .../helm-release.sh apply`，当前 `headlamp` release 已创建成功，`REVISION=1 / STATUS=deployed`；Portal live ConfigMap 也已更新并滚动生效，现在能直接回读 `Headlamp / 30087 / cards.headlamp`。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh` 通过；`ONLY=headlamp SKIP_REPO_UPDATE=1 bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template` 通过；`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh` 在 release 创建后已能输出 `Headlamp URL / ServiceAccount / Token duration` 头部信息。Portal live ConfigMap 回读已包含新的 Headlamp 卡片文案。
- 下一步：如果继续追 live 收口，优先处理 Headlamp 镜像拉取链路。当前 Pod 失败不是配置错误，而是节点从 `ghcr.io` / `pkg-containers.githubusercontent.com` 拉镜像时命中 `connection reset by peer`；更稳的下一步是把 `ghcr.io/headlamp-k8s/headlamp:v0.40.1` 镜像预热到三台节点或收口到本地 Harbor，再重新触发 Pod。
- 阻塞/风险：Headlamp 当前 live release 已创建，但 Pod 仍停在 `ErrImagePull/ImagePullBackOff`，根因是节点对 `ghcr` 拉镜像不稳定，而不是 Headlamp chart 本身错误。因此 Portal 虽然已经出现 Headlamp 入口，当前浏览器直连 `http://192.168.0.108:30087` 仍可能暂时返回 `502`，直到镜像拉取链路问题被收掉。

## 2026-03-24 22:25
- 完成：继续把 Headlamp 与 Harbor 的 live 问题收回仓库真源。节点基线侧，更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/BEST_PRACTICES.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`，把先前只影响用户态解析优先级的 `/etc/gai.conf` 方案收回为节点级禁 IPv6 的 `sysctl` 基线，并已在三台 live 节点确认 `net.ipv6.conf.{all,default,lo}.disable_ipv6=1`。Harbor 入口侧，继续维护 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/harbor-ui-proxy.yaml` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/lab-platform/files/raw/harbor-ui-proxy.yaml`，保持 `harbor-ui-proxy` 与 `harbor-core` 同节点、并显式透传 `Host/X-Forwarded-Host`，避免外部入口再随机落到 `502`。
- 完成：把 `ghcr.io/headlamp-k8s/headlamp:v0.40.1` 正式导入实验室 Harbor。由于节点直连 `ghcr` 仍不稳，最终采用“工作站拉取 blob -> 经 `harbor-core` Pod 内部上传 Harbor API”的路径，将镜像收口为 `harbor.192.168.0.108.nip.io:32668/library/headlamp:v0.40.1`；Harbor 内部 API 已可回读该 artifact，digest 为 `sha256:41004fa1df8dd591ce8dbe955ba5b52558ddaee92cf6225129bc2b96413b9561`。
- 完成：发现上游 `headlamp/headlamp 0.40.1` chart 默认会无条件注入 `-session-ttl=86400`，而同版本 `v0.40.1` 镜像并不识别该参数，导致 Pod 持续 `CrashLoopBackOff`。为避免继续受远端 chart 默认值牵制，新增本地 chart `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/headlamp/`，并更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/headlamp-values.yaml`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh`、`/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`：本地 chart 新增 `config.enableSessionTTLFlag` 开关，实验室 values 显式设为 `false`，从模板层彻底禁止再渲染 `-session-ttl`，同时继续固定 Headlamp 镜像走 Harbor 真源。
- 验证：`helm template /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/headlamp -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/headlamp-values.yaml` 已确认不再出现 `-session-ttl`；`helm lint` 与 `bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 均通过。live 侧执行 `SKIP_REPO_UPDATE=1 ONLY=headlamp bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply` 后，`headlamp` 已升到 `REVISION=4 / STATUS=deployed`，Deployment 当前参数只剩 `-in-cluster / -in-cluster-context-name=main / -enable-helm / -plugins-dir=/headlamp/plugins`，Pod `1/1 Running`，`rollout status` 成功；`bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh` 也已能正常输出 `headlamp-admin` 临时 token。
- 验证：用户入口现已全部回绿。`curl` 复核结果为：`http://192.168.0.108:30087/` `200`、`http://192.168.0.108:30002/` `200`、`http://192.168.0.108:30002/api/v2.0/ping` 返回 `Pong`；同时标准值班入口 `30088 / 32668/readyz / 30081/login / 30090/-/ready / 30093 / 30443` 也全部 `200`。最后再次实跑 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh`，结果为三节点 `Ready`、`longhorn_faulted_volumes=none`、`longhorn_degraded_volumes=none`、`longhorn_schedulable_nodes=3`，并成功刷新 `cold-start` 摘要。
- 下一步：若继续增强值班体验，可在 Portal 或 runbook 里补一条 Headlamp 使用约定，例如常用命名空间过滤、日志查看与 YAML 回查路径；当前功能性修复已完成，不再阻塞值班访问。
- 阻塞/风险：Headlamp 与 Harbor 现在都已可访问，但实验室外网链路对 `ghcr` 仍然不稳，因此后续若升级 Headlamp 版本，仍应优先走 Harbor 镜像镜像/预热，而不是重新依赖节点直拉 `ghcr`。
- 完成：按值班习惯把 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh` 的默认 token 时长从 `24h` 调整为 `90d`，并补了对 `90d`、`30d` 这类“按天数表达”的兼容转换。脚本内部现在会把天数自动换算成 `kubectl create token` 可接受的小时单位，再继续打印人可读的 `90d/30d` 头部信息；对应访问文档 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md` 也已同步更新默认值说明。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh` 通过；默认执行脚本时头部已显示 `Token duration: 90d`，额外回归 `TOKEN_DURATION=30d` 时头部也能正常显示 `Token duration: 30d`，说明“按天数输入 -> 自动转换 -> 成功生成 token”这条路径已经成立。
## 2026-03-25 10:20
- 完成：在回答 `lab-ha` 实验环境是否需要继续加服务组件时，复核了 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`ACCESS.md`、`BEST_PRACTICES.md`、`OPS_CHECKLIST.md` 的当前口径，并顺手修正文档漂移：`BEST_PRACTICES.md` 原先把已落地的 `Velero / Sealed Secrets` 仍写成未来扩展，现已改成更准确的“后续如节点升级，再补 Velero 数据面备份能力”，避免后续 AI/维护者继续把现状误判为未部署。
- 下一步：基于当前 `3 x 4C/8G + 同宿主机单点 + Portal/Grafana/Headlamp/Argo` 的实验口径，继续按“少加重组件、优先补访问治理和恢复能力”给出后续组件建议。
- 阻塞/风险：当前仓库文档总体已一致，但这套实验仍然是软件层 HA 而不是硬件级 HA；因此任何新增服务的价值，都应先和“是否真的降低现场风险”对齐，避免为了功能名词继续抬高维护复杂度。

## 2026-03-26 13:45
- 完成：同步补齐 webapp-template 的前端样式改动约束。项目级 `/Users/simon/projects/webapp-template/AGENTS.md` 现已明确：样式任务要先连真实浏览器定位，显式检查 box 关系与边界样本，并区分“回归”和“冒烟”；当前仓库暂无固定 `style:l1/l2/l3` 入口，因此样式任务默认需要浏览器级回归，外加 `cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test`。
- 完成：同步更新 `/Users/simon/projects/webapp-template/README.md` 与 `/Users/simon/projects/webapp-template/scripts/README.md`，把 `fast.sh` 定位为更接近粗粒度冒烟/快速检查，把 `full.sh` 定位为仓库级 QA 全量检查，并明确它们都不能替代前端样式任务的浏览器级回归。
- 验证：后续补跑 `bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh` 与 `bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`；本轮文档改动已通过 `git -C /Users/simon/projects/webapp-template diff --check -- AGENTS.md README.md scripts/README.md progress.md`。
- 下一步：若模板派生项目后续出现高频样式问题，可在对应仓库继续补固定浏览器 fixture 或 Playwright 脚本，不必在模板里预埋一整套高复杂度入口。
- 阻塞/风险：当前只是把规则与术语边界写清楚，尚未为模板仓库新增固定浏览器样式脚本；后续执行质量仍依赖任务内是否真的连浏览器做页面级回归。

## 2026-03-28 00:10
- 完成：补齐 `/Users/simon/projects/webapp-template/web/README.md` 的前端样式回归口径，明确当前模板仓库尚无固定 `style:l1/l2/l3` 浏览器脚本入口，样式/布局任务仍需配合真实浏览器做页面级回归；同时把 `pnpm test` 的职责收口为“最小前端基线”，避免被误读成样式验收替代品。
- 下一步：若模板本身或派生项目持续频繁出现同类前端样式问题，再评估是否在模板仓库内补最小浏览器级 `L1` fixture / Playwright 脚本。
- 阻塞/风险：模板仓库当前仍以规则和文档约束为主，尚未沉淀固定浏览器级样式脚本；后续执行质量仍取决于具体任务是否真的连浏览器回归。

## 2026-04-02 11:20
- 完成：按“`Tailscale` 只作为外部运维访问入口，不作为业务公网发布方案”的边界，为 `lab-ha` 正式补齐 tailnet 接入真源。新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TAILSCALE.md`，明确 subnet router 形态、落地步骤、DNS 边界、回退方式与验证命令；新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh`，用于在边界主机或宿主机侧通过 SSH 安装并配置 `Tailscale subnet router`，持久开启 `net.ipv4.ip_forward`，并广播 `192.168.0.0/24`。同时同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/README.md`、`ACCESS.md`、`INTERNAL_DNS.md`、`PROD_TRIAL.md`、`OPS_CHECKLIST.md`、`BEST_PRACTICES.md` 与 `/Users/simon/projects/webapp-template/server/deploy/README.md`，把“外部通过 Tailscale 进入、内部仍按 NodePort + Host / internal DNS 验证”的口径写成正式说明。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh` 通过；`git diff --check -- server/deploy/README.md server/deploy/lab-ha/docs/README.md server/deploy/lab-ha/docs/ACCESS.md server/deploy/lab-ha/docs/INTERNAL_DNS.md server/deploy/lab-ha/docs/PROD_TRIAL.md server/deploy/lab-ha/docs/OPS_CHECKLIST.md server/deploy/lab-ha/docs/BEST_PRACTICES.md server/deploy/lab-ha/docs/TAILSCALE.md server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh` 通过。
- 下一步：若要真正启用，准备 tailnet auth key / tag owner 后，在目标边界主机执行新脚本并到 Tailscale 管理台审批 `192.168.0.0/24` 路由；审批后再从 tailnet 客户端按 `TAILSCALE.md` 回归 `Portal / Grafana / Argo CD / prod-trial readyz`。
- 阻塞/风险：本轮只完成仓库真源与脚本落地，没有持有真实 `TAILSCALE_AUTH_KEY` 去连实际 tailnet，也没有在 live 节点上执行安装；因此“脚本语法与文档闭环”已验证，但“真实 Tailscale 控制面审批 / 路由生效 / 外部客户端连通性”仍需现场执行后再确认。

## 2026-04-02 14:55
- 完成：收到真实 `TAILSCALE_AUTH_KEY` 后，已在 live 路由主机 `root@192.168.0.108` 实跑 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh`。期间按现场反馈继续修正脚本幂等与兼容性：远端安装逻辑改为“本地先打印变量赋值，再通过 `ssh ... 'bash -s'` 喂给远端”，避免 heredoc 在本地提前展开触发 `unbound variable`；`tailscale up` 默认追加 `--reset`，避免二次重跑被旧 state 拦截；`TAILSCALE_ADVERTISE_TAGS` 默认值改为可被显式空字符串覆盖，便于当前 auth key 无 tag 权限时临时禁用 tag；对应 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TAILSCALE.md` 与 `ACCESS.md` 也同步补充了“无 tag 权限时可传空值”与“已有同网段旧路由时需在控制台决定 primary route”的说明。
- 验证：远端 `tailscale status` 已显示新节点 `lab-ha-router`，tailnet IPv4 为 `100.110.51.53`，`tailscale debug prefs` 已确认本机配置为 `Hostname=lab-ha-router`、`RunSSH=true`、`AdvertiseRoutes=[192.168.0.0/24]`。同时远端 `tailscale status --json` 也暴露了当前 live 尾项：tailnet 内已有设备 `zos` 作为 `192.168.0.0/24` 的现有 `PrimaryRoutes`，因此 `192.168.0.108` 这台新路由机虽已入网并开始广告该网段，但是否真正接管流量，仍取决于 Tailscale 管理台的路由审批与主路由选择。
- 下一步：到 Tailscale 管理台审批或切换 `192.168.0.0/24` 路由；如果希望当前 `lab-ha-router (192.168.0.108)` 成为主路由，需要在控制台上取消旧设备 `zos` 的同网段主路由，或把新路由设为 primary。完成后，再从 tailnet 客户端回归 `Portal / Grafana / Argo CD / prod-trial readyz`。
- 阻塞/风险：当前 live 实跑是通过 `TAILSCALE_ADVERTISE_TAGS=''` 临时禁用了 `tag:lab-ha-router`，因为这把 auth key 尚未获准使用该 tag；另外，节点基线关闭 IPv6，因此 `tailscale up` 会提示 `IPv6 forwarding is disabled`，在当前只广播 IPv4 `192.168.0.0/24` 的场景下可接受，但仍不是“所有 warning 清零”的最终收口状态。

## 2026-04-03 00:25
- 完成：补齐 `/Users/simon/projects/webapp-template/AGENTS.md` 的数据库迁移执行边界，明确当问题已定位为“当前开发库缺少仓库中已存在的迁移”时，AI 可直接执行 `cd /Users/simon/projects/webapp-template/server && make migrate_apply`，再按仓库实际提供的方式做 schema 校验；若仓库没有固定 `db_schema_check` 目标，则至少以 `migrate_apply` 成功输出和只读 schema 查询确认结果。同时写清了仅限开发库/非生产库、先确认配置来源，以及生产库/共享库/高风险迁移仍需先说明风险再继续。
- 下一步：后续若模板派生项目继续复用这套规则，可再按项目形态决定是否把同样边界同步写入各自 README 或 DB runbook，减少只看 `AGENTS.md` 才知道的隐性约束。
- 阻塞/风险：当前只更新了 AI 协作约束，没有替模板仓库新增自动探测“缺迁移即提示 apply”的脚本；后续执行质量仍依赖 AI 先核对数据库来源，再按规则落地。

## 2026-04-03 00:40
- 完成：补齐 `/Users/simon/projects/webapp-template/server/internal/data/AI_DB_WORKFLOW.md`，把“开发库仅缺仓库内已存在迁移时的默认动作”写成正式 DB workflow：直接执行 `make migrate_apply`，不要重生成 migration、不要手动改库，并在 apply 后以成功输出和只读 schema 查询确认结果。同时顺手修正了项目级规则里误写的 `make db_schema_check`，避免后续 AI 再按不存在的命令执行。
- 下一步：若模板后续新增了统一 schema 校验目标，可再把 workflow 中“只读确认”的描述收口为固定命令，减少每次按库结构手工确认的心智成本。
- 阻塞/风险：当前模板仓库仍未提供统一的 schema 校验 make target，因此“apply 后确认”依旧需要结合迁移输出和只读查询完成；规则已明确，但还没有完全脚本化。

## 2026-04-03 21:02
- 完成：为 `/Users/simon/projects/webapp-template/AGENTS.md` 补齐线上迁移联动约束。模板仓库现已明确：开发库缺少仓库内既有 migration 时可按既有规则直接 `make migrate_apply`，但线上发布前必须先核对 migration 状态，pending migration 默认禁止继续发布依赖该 schema 的版本，避免后续派生项目继续复用“先发代码、再手补库”的高风险流程。
- 完成：为 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 补上线上 migration 门禁。脚本现新增 `REMOTE_MIGRATE_SCRIPT_NAME`、`REMOTE_MIGRATE_DIR_NAME`、`LOCAL_MIGRATE_SCRIPT`、`LOCAL_MIGRATE_DIR` 与 `DB_MIGRATION_MODE=off|check|apply`，默认发布前先同步 `migrate_online.sh` 和 migration 目录到远端，再执行 `status + dry-run`；发现 pending migration 就直接阻断发布。这层能力属于模板基线，后续派生项目若沿用 Compose 发布脚本，会直接继承这套保护。
- 完成：同步更新 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md`，把 migration 联动的环境变量、默认行为和适用原因写成正式模板说明，避免只在脚本里存在隐性规则。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh`；`git -C /Users/simon/projects/webapp-template diff --check -- AGENTS.md server/deploy/compose/prod/README.md server/deploy/compose/prod/publish_server.sh`。
- 下一步：若要把这套规则继续收口成模板外层入口，可再考虑把“Compose 发布默认带 migration 门禁”补一句到 `/Users/simon/projects/webapp-template/server/deploy/README.md` 或 `docs/deployment-conventions.md`，进一步降低派生项目只看总览文档时漏读细则的概率。
- 阻塞/风险：本轮只补了模板脚本和模板文档，没有在某个派生项目或真实宿主机上演练 `DB_MIGRATION_MODE=check/apply`；模板能力本身已静态通过，但真实派生项目仍需要按各自远端目录、容器名和 compose 文件名再做一次现场验证。

## 2026-04-06 01:56
- 完成：把 `lab.saurick.space` 从“动态 IPv6 + 8080 临时入口”收口成“动态 IPv6 + 443 正式入口”。本机继续由 `/Users/simon/.config/ddns-go/lab-saurick.yaml` 驱动 `ddns-go` 维护 AAAA 记录，但不再走 Cloudflare 橙云代理；新增 `/Users/simon/.config/lab-public/Caddyfile` 与 `/Users/simon/.config/lab-public/com.simon.lab-saurick.caddy.plist`，在本机 IPv6 `80/443` 上启动 `Caddy`，自动为 `lab.saurick.space` 申请 Let’s Encrypt 证书，并直接反代到实验入口 `http://192.168.0.108:30089`。同时停掉了先前仅为过渡链路准备的用户级 `8080` 代理，并删除了中途试验过的 `lab-public` K8s 公开资源，避免继续保留无收益中间层。
- 验证：Cloudflare DNS API 已确认 `lab.saurick.space` 继续直连到 `240e:3b1:26f9:abe0:14f2:13e5:e131:cc58`；`sudo lsof -nP -iTCP:80 -sTCP:LISTEN` 与 `...:443...` 已确认当前由 `OrbStack` 负责 IPv4、本机 `caddy` 负责 IPv6；`openssl s_client -connect '[240e:3b1:26f9:abe0:14f2:13e5:e131:cc58]:443' -servername lab.saurick.space | openssl x509 -noout -subject -issuer -dates` 已确认签发证书 `CN=lab.saurick.space`、颁发方 `Let's Encrypt E8`；`curl --noproxy '*' --resolve 'lab.saurick.space:443:240e:3b1:26f9:abe0:14f2:13e5:e131:cc58' -I https://lab.saurick.space/` 返回 `HTTP/2 200`；远程抓取 `https://r.jina.ai/http://https://lab.saurick.space/` 与 `/login` 已分别读到首页和登录页正文，说明公网侧 `HTTPS` 路径已可用。
- 下一步：若后续还要继续扩大展示面，可按同样方式为 preview 单独补一个子域名，或再给当前 `Caddy` 入口补基础访问控制；若只作为临时展示页，现阶段可以先保持最小配置不再扩展。
- 阻塞/风险：当前入口依赖本机在线、`ddns-go` 正常运行以及这台 Mac 的 IPv6 前缀稳定；若本机休眠、切网或系统升级导致 `launchd`/Homebrew 路径变化，`https://lab.saurick.space/` 会中断。另外，本机存在全局 `http_proxy/https_proxy/all_proxy`，若浏览器或终端继续强制走本地代理，可能出现“站点已通，但本机某些访问路径仍失败”的假告警；判断可用性时应优先以直连或外部探测结果为准。

## 2026-04-06 14:32
- 完成：按“`zos` 继续承担整个 `192.168.0.0/24` 外部子路由，`lab-ha-router` 只做 `lab-ha` 运维入口机”的新口径，已在 live 主机 `root@192.168.0.108` 执行 `tailscale set --advertise-routes=''`，让 `lab-ha-router` 退回普通 tailnet 主机并保留 `Tailscale SSH`。同时把仓库真源从“默认部署 subnet router”改成“默认配置运维入口机、只有显式传 `TAILSCALE_ROUTES` 才广告子路由”：新增 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh` 作为正式脚本名，旧的 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh` 仅保留兼容跳转；并同步更新 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TAILSCALE.md`、`README.md`、`ACCESS.md`、`BEST_PRACTICES.md`，把“已有 `zos` 时不要默认抢 `/24`”写成正式说明。
- 验证：`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh`、`bash -n /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh` 通过；`git -C /Users/simon/projects/webapp-template diff --check -- server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh server/deploy/lab-ha/scripts/install-tailscale-subnet-router.sh server/deploy/lab-ha/docs/TAILSCALE.md server/deploy/lab-ha/docs/README.md server/deploy/lab-ha/docs/ACCESS.md server/deploy/lab-ha/docs/BEST_PRACTICES.md` 通过；远端 `tailscale debug prefs` 已确认 `Hostname=lab-ha-router`、`RunSSH=true`、`AdvertiseRoutes=null`，本机 `tailscale status --json` 已确认 `zos` 继续保留 `192.168.0.0/24` 的 `PrimaryRoutes`，`lab-ha-router` 的 `AllowedIPs` 已收缩为自身 tailnet IP。
- 下一步：如果后续确实要把 `192.168.0.0/24` 的主入口从 `zos` 迁到 `lab-ha-router`，再显式用 `TAILSCALE_ROUTES=192.168.0.0/24` 重跑新脚本，并在 Tailscale 管理台切换主路由；若继续沿用当前设计，则只需要把外部值班/发布入口统一收口到“`zos` 负责整段 LAN，`lab-ha-router` 负责 SSH/跳板/宿主机运维”。
- 阻塞/风险：当前 `lab-ha-router` 退回普通运维入口机后，若某个外部 tailnet 客户端既不走 `zos` 的子路由，也不做 `SSH` 隧道，就不能直接访问 `192.168.0.108:30088` 这类内网地址；另外，旧脚本名虽然只剩兼容包装，但历史 `progress.md` 仍会引用它，后续若彻底删除该兼容入口，需要一并回收这些历史路径引用。
