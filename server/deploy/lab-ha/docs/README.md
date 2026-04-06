# 3 节点实验室高可用部署文档

这套目录是 `webapp-template` 在三台实验室虚拟机上的完整高可用部署落点，目标是：

- 保持和当前项目技术栈兼容
- 在 `3 x 4C/8G` 资源下稳定运行
- 让后续 AI 或人工运维能快速接手
- 明确区分“实验室 HA”与“硬件级 HA”边界

## 目录说明

- `docs/ha-lab-plan-v2.md`: 方案与选型背景
- `docs/ha-lab-runbook.md`: 分阶段部署 Runbook
- `docs/ACCESS.md`: 当前可访问地址、凭据与取值命令
- `docs/BEST_PRACTICES.md`: 资源、治理、镜像、发布、备份等最佳实践
- `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`: 项目级部署真源约定
- `docs/TEST_REPORT.md`: 已完成的联调与故障演练结果
- `docs/HANDOVER.md`: 给后续 AI/工程师的接手说明
- `docs/PROD_TRIAL.md`: WebApp 生产试验 Runbook
- `docs/LOAD_TEST.md`: 实验室最小压测能力与观测口径
- `docs/INTERNAL_DNS.md`: 内部域名与内网 DNS 说明
- `docs/PUBLIC_GATEWAY.md`: 宿主机公网 `Caddy` 网关配置与 GitLab cookie 共享口径
- `docs/CILIUM_GATEWAY_MIGRATION.md`: `Cilium Gateway API` 正式切换说明
- `docs/TAILSCALE.md`: 外部运维访问通过 Tailscale 接入的边界、运维入口机脚本与验证方式
- `docs/OPS_CHECKLIST.md`: 日常巡检清单
- `docs/HIGH_PERFORMANCE_SERVER_BASELINE.md`: 未来迁移到更强宿主机前的采购/验收基线清单
- `docs/CILIUM_HUBBLE_RUNBOOK.md`: Cilium eBPF 与 Hubble 运行/排障手册
- `docs/TROUBLESHOOTING.md`: 常见故障排查手册
- `docs/RECOVERY_RUNBOOK.md`: 恢复与故障演练手册
- `docs/VM_POWER_SEQUENCE.md`: 三台 VM 计划性关机 / 开机顺序、影响与验收口径
- `scripts/helm-release.sh`: Helm 统一入口，负责 repo 初始化、模板渲染与 release 同步
- `scripts/harden-gitlab-instance.sh`: 收口独立 GitLab 实例的管理员基线，关闭公开注册与 usage/service ping，并按需重载 Puma
- `charts/lab-platform/`: Jaeger、Loki、Grafana、Portal、NodePort、Argo 补充对象等平台级本地 chart
- `charts/headlamp/`: 实验室收口后的 Headlamp 本地 chart；用于修正上游 chart 与 `v0.40.1` 镜像的参数不兼容
- `charts/webapp-template/`: `lab`、`prod-trial` 复用的业务 chart
- `manifests/seaweedfs-values.yaml`: SeaweedFS 实验室值文件
- `manifests/loki-standalone.yaml`: Loki 轻量化独立部署
- `manifests/velero-values.yaml`: Velero 对接 SeaweedFS S3 的值文件
- `manifests/sealed-secrets-values.yaml`: Sealed Secrets 控制器值文件
- `manifests/alertmanager-values.yaml`: Alertmanager 路由与 webhook 出口配置
- `manifests/kube-prometheus-stack-values.yaml`: 监控栈核心值文件
- `manifests/cilium-values.yaml`: Cilium 与 Hubble 值文件
- `manifests/argo-cd-values.yaml`: Argo CD 值文件
- `manifests/harbor-values.yaml`: Harbor 值文件
- `manifests/longhorn-values.yaml`: Longhorn 值文件，含 `autoSalvage`、`autoDeletePodWhenVolumeDetachedUnexpectedly`、`nodeDownPodDeletionPolicy` 与默认盘保留比例
- `manifests/app-pg-cluster.yaml`: CloudNativePG `app-pg` 集群真源，含 `switchoverDelay=30`、`stopDelay=60`
- `manifests/promtail-values.yaml`: Promtail 值文件
- `manifests/jaeger.yaml`: Jaeger v2 轻量 tracing 基线
- `manifests/platform-nodeports.yaml`: 当前稳定直连入口端口映射
- `manifests/platform-portal.yaml`: 实验室门户页
- `manifests/prometheus-rule-service-governance.yaml`: 服务治理告警规则（HPA、PDB、正式入口 down/slow）
- `manifests/grafana-lab-overview-dashboard.yaml`: Grafana 值班总览看板
- `manifests/grafana-lab-service-governance-dashboard.yaml`: Grafana K8s 工作负载 / 服务治理看板（节点、工作负载、HPA、正式入口、PDB、Pod 健康）
- `manifests/grafana-lab-loadtest-dashboard.yaml`: Grafana 压测趋势看板
- `manifests/grafana-lab-loadtest-official-dashboard.yaml`: 官方 k6 Prometheus 看板（已适配实验室数据源）
- `manifests/grafana-lab-data-services-dashboard.yaml`: Grafana 数据与存储看板
- `manifests/grafana-lab-postgres-backup-dashboard.yaml`: Grafana PostgreSQL 与备份看板
- `manifests/grafana-lab-gitops-dashboard.yaml`: Grafana GitOps 与交付看板
- `manifests/grafana-loki-datasource.yaml`: Grafana Loki 数据源
- `manifests/grafana-jaeger-datasource.yaml`: Grafana Jaeger 数据源与 trace 回查日志配置
- `manifests/argocd-rollouts-metrics.yaml`: Argo CD / Argo Rollouts 指标采集清单
- `manifests/blackbox-values.yaml`: Blackbox Exporter 探测配置
- `manifests/metrics-server-values.yaml`: Metrics Server 值文件，给 HPA 提供资源指标
- `manifests/gateway-api-v1.4.1-standard-install.yaml`: Gateway API CRD 真源，供 Cilium Gateway Controller 使用
- `manifests/lab-public-caddy.Caddyfile`: 宿主机公网 `Caddy` 网关模板，包含 GitLab `Domain=.saurick.space` cookie 共享配置
- `manifests/headlamp-values.yaml`: Headlamp 值文件，固定当前实验室 K8s UI 入口
- `manifests/alert-webhook-receiver.yaml`: 实验室默认 webhook 告警接收页，可查看最近 payload
- `manifests/webapp-governance.yaml`: webapp 命名空间治理基线
- `manifests/webapp-template-lab.yaml`: 旧实验室应用清单副本，仅作历史 render 参考，不再是安装真源
- `manifests/argocd-webapp-app.yaml`: Argo CD Application
- `manifests/argocd-webapp-prod-trial-app.yaml`: WebApp 生产试验 Argo CD Application
- `charts/webapp-template/values-prod-trial.yaml`: WebApp 生产试验 chart values
- `argocd/webapp-prod-trial/runtime-secret.example.yaml`: WebApp 生产试验运行时 Secret 示例
- `manifests/argocd-repo-secret-sealed.yaml`: Argo CD 仓库凭据的 SealedSecret
- `scripts/ha-node-bootstrap.sh`: 节点初始化脚本，包含静态 IP/swap/防火墙/multipathd/关闭 IPv6 等基线
- `scripts/check-ha-lab-cold-start.sh`: 节点重启 / 整集群冷启动后的统一验收脚本，同时刷新 Portal 里的最近冷启动摘要
- `scripts/verify-ha-lab-drill.sh`: 在真实故障演练后复跑统一验收，并把“最近 HA 演练”摘要写到 Portal
- `scripts/cleanup-stale-controlled-pods.sh`: 带边界地清理全量冷启动后残留的 `Unknown/Terminating` controller Pod
- `scripts/check-velero-backup-status.sh`: Velero 备份状态统一检查脚本，同时刷新 Portal 里的最近备份摘要
- `scripts/check-webapp-prod-trial-tracing.sh`: 触发 WebApp 请求并确认 Jaeger 中出现服务名
- `scripts/check-webapp-prod-trial-bluegreen.sh`: 同时校验 prod-trial active / preview 两条入口，并刷新 Portal 里的最近烟雾检查摘要
- `scripts/get-headlamp-token.sh`: 生成 `headlamp-admin` 的临时登录 token
- `scripts/sync-headlamp-portal-token.sh`: 生成 `headlamp-admin` 的 10 年 token，并同步到 Portal runtime Secret
- `scripts/configure-tailscale-ops-host.sh`: 在边界主机或宿主机侧安装并配置 Tailscale 运维入口机；若无现成 LAN 子路由，再显式开启 `TAILSCALE_ROUTES`
- `scripts/write-lab-ops-summary.sh`: 将最近一次冷启动 / 备份 / 烟雾检查摘要写入 Alert Sink 持久化存储
- `scripts/patch-alert-link-overrides.sh`: 给高频值班告警补本地 dashboard/runbook 链接
- `/Users/simon/projects/webapp-template/scripts/loadtest/`: 仓库内最小 `k6` 压测脚本与统一入口
- `artifacts/webapp-template-server-ha-lab.tar`: 本次实验构建出的应用镜像归档

## 当前范围

- 这是“实验室软件层高可用”
- 三台 VM 位于同一稳定宿主机上，宿主机仍是单点
- 当前外部访问主入口统一收口为 `192.168.0.108` 的直连 `IP:Port`
- 这是对当前虚拟化网络和用户本机代理环境最稳定、最易维护的口径
- `Cilium Gateway API` 已正式接管 `WebApp Lab / Prod-Trial Active / Prod-Trial Preview` 三条业务入口
- `Portal` 已作为默认起始页，包含入口导航、默认账号、Headlamp 10 年 token 复制卡、文档直达链接，以及面向值班的“当前开机进度 / 当前关机进度”live 区域
- `Portal` 当前既会展示“当前开机进度 / 当前关机进度 / 下一台建议”，也会展示最近一次冷启动验收、最近一次 HA 演练、最近一次备份检查、最近一次烟雾检查；最近结果摘要继续复用 Alert Sink 已持久化的轻量存储，避免重启后整块上下文直接清空
- `Portal` 的关机进度卡片只负责回答“现在能不能继续关下一台”；由于 Portal 自己固定在 `node2 / 192.168.0.108`，当下一步轮到关闭 `node2` 时，卡片会明确提示“这是最后一个可视步骤”，后续最终关机仍以虚拟化平台电源状态为准
- `Portal` 现在也会显式给出 `K8s Workloads` 与 `Headlamp` 两类 K8s 入口，避免值班人员在“看趋势”与“看对象细节”之间来回猜测
- 面向人操作的日常巡检、值班和恢复，默认先看 `Portal + Grafana Ops + K8s Workloads + Headlamp + Alert Sink + Alertmanager + Argo CD` 这些 live 页面，再决定是否执行脚本
- 当前对人展示统一口径：`WebApp Lab`、`WebApp Prod-Trial Active`、`WebApp Prod-Trial Preview`
- 技术命名暂保持不变：`webapp` / `webapp-prod-trial` 命名空间与对应 Argo app 名仍作为底层真名
- 当前对外可承诺的最低基线，应至少包含“节点重启后 swap 不会回挂 + `/etc/fstab` 不再保留生效中的 swap 挂载 + 主机防火墙保持关闭态 + `multipathd` 保持关闭 + kubelet 能自动恢复 + Longhorn 冷启动策略已经收口 + `check-ha-lab-cold-start.sh` 全量通过”
- 对外固定入口节点不能继续依赖 DHCP；像 `192.168.0.108` 这类被 Portal、GitLab、Harbor、Argo CD 与 kubeadm 广告地址共同依赖的节点 IP，必须在宿主机 `netplan` 层持久收口为静态地址
- 对值班直接有帮助且体量可控的数据，默认要做轻量持久化；当前基线包括 `Alert Sink` 最近 webhook payload 与 `Jaeger` 最近 traces
- 若需要让少量运维人员从实验室外访问当前环境，当前推荐先把集群外或宿主机侧的稳定主机接入 `Tailscale` 作为运维入口机；若 tailnet 已有现成 `192.168.0.0/24` 子路由，例如当前的 `zos`，不要再让 `lab-ha` 主机默认抢同一条路由

## Helm 使用口径

- 这套 Helm 约定只覆盖 `server/deploy/lab-ha`，不覆盖 `/Users/simon/projects/webapp-template/server/deploy/compose/prod` 的单机 Compose 路径。
- 当前 `lab-ha` 的第三方组件 chart 版本已固定到 live 集群现状，统一入口是 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh <repos|template|apply|list>`
- `lab-platform` 发布后，`helm-release.sh` 会自动重启 `alert-webhook-receiver`，确保 ConfigMap 里的 `receiver.py` 路由与 Portal 摘要 API 立即生效，而不是停留在旧进程代码
- `helm-release.sh apply` 现在会先做一轮短 API 稳定性预检：只有 `readyz` 和 `kubectl get nodes` 都能在当前运维机侧稳定返回，才会继续执行 Helm。这样能把“控制面/API 链路临时抖动”尽早暴露成明确错误，而不是表现成 Helm 长时间无输出
- `helm-release.sh apply` 现在会在每个 release 开始前打印 `Applying release ...`，并默认给 `helm upgrade` 加 `--timeout 120s`；若现场需要更长观察窗口，可临时设置 `HELM_TIMEOUT=<duration>`
- 如果 `kubectl get ...` 或 `helm-release.sh apply` 仍偶发 `context deadline exceeded`，先执行 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-node-pressure.sh`；当前已知更像同宿主机 VM 的 CPU steal / I/O 抖动，而不是 `lab-platform` chart 真源持续损坏
- Headlamp 当前通过仓库内 `charts/headlamp` 安装，基于 `0.40.1` 上游 chart 收口了 `sessionTTL` 参数兼容性；内网直连入口为 `http://192.168.0.108:30087`。Portal 当前会通过 `lab-portal/lab-portal-headlamp-access` runtime Secret 暴露一条 10 年 token 复制卡；明文不进入 git，需通过 `scripts/sync-headlamp-portal-token.sh` 生成/轮换
- 若历史手工 `kubectl apply` 资源导致 Helm 首次接管失败，可仅在迁移那一次追加 `HELM_TAKE_OWNERSHIP=1`；若进一步遇到旧 `kubectl-client-side-apply` field manager 与 Helm v4 server-side apply 的字段冲突，可再临时叠加 `HELM_FORCE_CONFLICTS=1`。release 进入稳态后，应恢复为默认命令，避免把日常发布放宽成“无条件接管”或“无条件强改冲突字段”。
- 平台自定义资源仍保留在 `manifests/` 目录，但 `helm-release.sh` 会在渲染前同步到 `charts/lab-platform/files/raw/`，由 Helm 接管实际安装；这样既不丢现有文档落点，也避免 dashboard JSON 里的 `{{...}}` 被 Helm 误解析
- `webapp-template-lab` 与 `webapp-template-prod-trial` 已统一改为同一个 Helm chart，由 Argo CD 按不同 values 文件渲染
- `webapp-template-prod-trial` 当前默认在同一张 chart 内启用蓝绿发布校验，active/preview 入口与交付看板统一在仓库真源里维护
- 若只想验证单个 release，可执行 `ONLY=cilium bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template`

## 当前已落地组件

- K8s: `kubeadm + kube-vip + Cilium + Hubble + MetalLB + Cilium Gateway API + cert-manager + metrics-server`
- K8s UI: `Headlamp`
- 存储: `Longhorn + SeaweedFS`
- 数据库: `CloudNativePG`
- 监控: `Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics + blackbox-exporter`
- 链路追踪: `Jaeger v2（单实例、Badger 本地持久化、7d TTL）`
- 日志: `Loki + Promtail`
- 备份与密钥: `Velero + Sealed Secrets`
- 发布与平台: `Harbor + GitLab + GitLab Runner + Argo CD + Argo Rollouts`
- 业务: `webapp-template`

补充说明：当前集群的 Pod 网络、NetworkPolicy 与 Service datapath 都统一收口到 `Cilium`；`kube-proxy replacement` 已开启，`ClusterIP / NodePort / LoadBalancer` 由 `Cilium eBPF` 处理。
补充说明：当前对外路由发布仍以现有 `MetalLB L2` 方案为主，`BGP` 暂未启用；是否继续引入 `Cilium BGP Control Plane`，按跨子网可达、对外路由收敛和多集群诉求单独评估。
补充说明：当前指标型 TSDB 就是 `Prometheus`；当前日志主线是 `Loki`，没有额外叠加 `ELK/OpenSearch`。
补充说明：当前 `WebApp Lab / Prod-Trial Active / Prod-Trial Preview` 的正式入口已统一改为 `Cilium Gateway hostNetwork` 对外端口：`32668 / 30089 / 30091`。
补充说明：若要先在本仓库推进低风险生产试验，请优先走 `docs/PROD_TRIAL.md` 的独立命名空间方案，不要直接覆盖当前 `lab` 应用。
补充说明：若当前阶段先走内网访问，内部 DNS 只需要把 `webapp-trial.lab.home.arpa` / `webapp-trial-preview.lab.home.arpa` 解析到三台节点 IP，再分别访问 `:30089 / :30091`；不再依赖旧的 Host 头 overlay。

## 推荐阅读顺序

1. `http://192.168.0.108:30088`
2. `docs/ACCESS.md`
3. `docs/OPS_CHECKLIST.md`
4. `docs/TROUBLESHOOTING.md`
5. `docs/RECOVERY_RUNBOOK.md`
6. `docs/VM_POWER_SEQUENCE.md`
7. `docs/TAILSCALE.md`
8. `docs/TEST_REPORT.md`
9. `docs/BEST_PRACTICES.md`
10. `docs/HANDOVER.md`
