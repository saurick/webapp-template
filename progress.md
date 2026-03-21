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
