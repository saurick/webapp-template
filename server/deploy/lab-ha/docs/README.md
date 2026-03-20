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
- `docs/INTERNAL_DNS.md`: 内部域名与内网 DNS 说明
- `docs/OPS_CHECKLIST.md`: 日常巡检清单
- `docs/TROUBLESHOOTING.md`: 常见故障排查手册
- `docs/RECOVERY_RUNBOOK.md`: 恢复与故障演练手册
- `scripts/helm-release.sh`: Helm 统一入口，负责 repo 初始化、模板渲染与 release 同步
- `charts/lab-platform/`: Jaeger、Loki、Grafana、Portal、NodePort/Ingress、Argo 补充对象等平台级本地 chart
- `charts/webapp-template/`: `lab`、`prod-trial`、`prod-trial internal` 复用的业务 chart
- `manifests/seaweedfs-values.yaml`: SeaweedFS 实验室值文件
- `manifests/loki-standalone.yaml`: Loki 轻量化独立部署
- `manifests/velero-values.yaml`: Velero 对接 SeaweedFS S3 的值文件
- `manifests/sealed-secrets-values.yaml`: Sealed Secrets 控制器值文件
- `manifests/alertmanager-values.yaml`: Alertmanager 路由与 webhook 出口配置
- `manifests/kube-prometheus-stack-values.yaml`: 监控栈核心值文件
- `manifests/ingress-nginx-values.yaml`: 入口控制器值文件，含 `externalTrafficPolicy=Cluster`
- `manifests/cilium-values.yaml`: Cilium 与 Hubble 值文件
- `manifests/argo-cd-values.yaml`: Argo CD 值文件
- `manifests/harbor-values.yaml`: Harbor 值文件
- `manifests/longhorn-values.yaml`: Longhorn 值文件
- `manifests/promtail-values.yaml`: Promtail 值文件
- `manifests/jaeger.yaml`: Jaeger v2 轻量 tracing 基线
- `manifests/platform-ingresses.yaml`: 平台 UI 入口
- `manifests/platform-nodeports.yaml`: 当前稳定直连入口端口映射
- `manifests/platform-portal.yaml`: 实验室门户页
- `manifests/grafana-lab-overview-dashboard.yaml`: Grafana 值班总览看板
- `manifests/grafana-lab-data-services-dashboard.yaml`: Grafana 数据与存储看板
- `manifests/grafana-lab-postgres-backup-dashboard.yaml`: Grafana PostgreSQL 与备份看板
- `manifests/grafana-lab-gitops-dashboard.yaml`: Grafana GitOps 与交付看板
- `manifests/grafana-loki-datasource.yaml`: Grafana Loki 数据源
- `manifests/grafana-jaeger-datasource.yaml`: Grafana Jaeger 数据源与 trace 回查日志配置
- `manifests/argocd-rollouts-metrics.yaml`: Argo CD / Argo Rollouts 指标采集清单
- `manifests/blackbox-values.yaml`: Blackbox Exporter 探测配置
- `manifests/alert-webhook-receiver.yaml`: 实验室默认 webhook 告警接收器
- `manifests/webapp-governance.yaml`: webapp 命名空间治理基线
- `manifests/webapp-template-lab.yaml`: 集群内实验室应用清单副本
- `manifests/argocd-webapp-app.yaml`: Argo CD Application
- `manifests/argocd-webapp-prod-trial-app.yaml`: WebApp 生产试验 Argo CD Application
- `manifests/argocd-webapp-prod-trial-app-internal.yaml`: 切换到 internal values 的 Argo CD Application
- `charts/webapp-template/values-prod-trial.yaml`: WebApp 生产试验 chart values
- `charts/webapp-template/values-prod-trial-internal.yaml`: WebApp 内部域名 values overlay
- `argocd/webapp-prod-trial/runtime-secret.example.yaml`: WebApp 生产试验运行时 Secret 示例
- `manifests/argocd-repo-secret-sealed.yaml`: Argo CD 仓库凭据的 SealedSecret
- `scripts/ha-node-bootstrap.sh`: 节点初始化脚本
- `scripts/check-webapp-prod-trial-tracing.sh`: 触发 WebApp 请求并确认 Jaeger 中出现服务名
- `artifacts/webapp-template-server-ha-lab.tar`: 本次实验构建出的应用镜像归档

## 当前范围

- 这是“实验室软件层高可用”
- 三台 VM 位于同一稳定宿主机上，宿主机仍是单点
- 当前外部访问主入口统一收口为 `192.168.0.108` 的直连 `IP:Port`
- 这是对当前虚拟化网络和用户本机代理环境最稳定、最易维护的口径
- `Portal` 已作为默认起始页，包含入口导航、默认账号、快照摘要与文档直达链接

## Helm 使用口径

- 这套 Helm 约定只覆盖 `server/deploy/lab-ha`，不覆盖 `/Users/simon/projects/webapp-template/server/deploy/compose/prod` 的单机 Compose 路径。
- 当前 `lab-ha` 的第三方组件 chart 版本已固定到 live 集群现状，统一入口是 `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh <repos|template|apply|list>`
- 平台自定义资源仍保留在 `manifests/` 目录，但 `helm-release.sh` 会在渲染前同步到 `charts/lab-platform/files/raw/`，由 Helm 接管实际安装；这样既不丢现有文档落点，也避免 dashboard JSON 里的 `{{...}}` 被 Helm 误解析
- `webapp-template-lab`、`webapp-template-prod-trial` 与 internal 变体已统一改为同一个 Helm chart，由 Argo CD 按不同 values 文件渲染
- 若只想验证单个 release，可执行 `ONLY=ingress-nginx bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template`

## 当前已落地组件

- K8s: `kubeadm + kube-vip + Cilium + Hubble + MetalLB + ingress-nginx + cert-manager`
- 存储: `Longhorn + SeaweedFS`
- 数据库: `CloudNativePG`
- 监控: `Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics + blackbox-exporter`
- 链路追踪: `Jaeger v2（单实例、内存存储）`
- 日志: `Loki + Promtail`
- 备份与密钥: `Velero + Sealed Secrets`
- 发布与平台: `Harbor + GitLab + GitLab Runner + Argo CD + Argo Rollouts`
- 业务: `webapp-template`

补充说明：当前指标型 TSDB 就是 `Prometheus`；当前日志主线是 `Loki`，没有额外叠加 `ELK/OpenSearch`。
补充说明：若要先在本仓库推进低风险生产试验，请优先走 `docs/PROD_TRIAL.md` 的独立命名空间方案，不要直接覆盖当前 `lab` 应用。
补充说明：若当前阶段先走内网访问，请优先使用 `manifests/argocd-webapp-prod-trial-app-internal.yaml` 对应的 internal values overlay，不要急着把业务入口直接暴露公网。
补充说明：当前内部生产试验的正式推荐入口，不再是单一 `192.168.0.108:32668`，而是 `webapp-trial.lab.home.arpa` 配合 `192.168.0.7 / 108 / 128` 多节点 A 记录，并统一访问 `:32668`。

## 推荐阅读顺序

1. `http://192.168.0.108:30088`
2. `docs/ACCESS.md`
3. `docs/OPS_CHECKLIST.md`
4. `docs/TROUBLESHOOTING.md`
5. `docs/RECOVERY_RUNBOOK.md`
6. `docs/TEST_REPORT.md`
7. `docs/BEST_PRACTICES.md`
8. `docs/HANDOVER.md`
