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
- `docs/TEST_REPORT.md`: 已完成的联调与故障演练结果
- `docs/HANDOVER.md`: 给后续 AI/工程师的接手说明
- `manifests/seaweedfs-values.yaml`: SeaweedFS 实验室值文件
- `manifests/loki-standalone.yaml`: Loki 轻量化独立部署
- `manifests/velero-values.yaml`: Velero 对接 SeaweedFS S3 的值文件
- `manifests/sealed-secrets-values.yaml`: Sealed Secrets 控制器值文件
- `manifests/alertmanager-values.yaml`: Alertmanager 路由与 webhook 出口配置
- `manifests/platform-ingresses.yaml`: 平台 UI 入口
- `manifests/platform-nodeports.yaml`: 当前稳定直连入口端口映射
- `manifests/platform-portal.yaml`: 实验室门户页
- `manifests/grafana-lab-overview-dashboard.yaml`: Grafana 值班总览看板
- `manifests/grafana-lab-data-services-dashboard.yaml`: Grafana 数据与存储看板
- `manifests/grafana-lab-postgres-backup-dashboard.yaml`: Grafana PostgreSQL 与备份看板
- `manifests/grafana-loki-datasource.yaml`: Grafana Loki 数据源
- `manifests/blackbox-values.yaml`: Blackbox Exporter 探测配置
- `manifests/alert-webhook-receiver.yaml`: 实验室默认 webhook 告警接收器
- `manifests/webapp-governance.yaml`: webapp 命名空间治理基线
- `manifests/webapp-template-lab.yaml`: 集群内实验室应用清单副本
- `manifests/argocd-webapp-app.yaml`: Argo CD Application
- `manifests/argocd-repo-secret-sealed.yaml`: Argo CD 仓库凭据的 SealedSecret
- `scripts/ha-node-bootstrap.sh`: 节点初始化脚本
- `artifacts/webapp-template-server-ha-lab.tar`: 本次实验构建出的应用镜像归档

## 当前范围

- 这是“实验室软件层高可用”
- 三台 VM 位于同一稳定宿主机上，宿主机仍是单点
- 当前外部访问主入口统一收口为 `192.168.0.108` 的直连 `IP:Port`
- 这是对当前虚拟化网络和用户本机代理环境最稳定、最易维护的口径
- `Portal` 已作为默认起始页，包含入口导航、默认账号、快照摘要与文档直达链接

## 当前已落地组件

- K8s: `kubeadm + kube-vip + Cilium + Hubble + MetalLB + ingress-nginx + cert-manager`
- 存储: `Longhorn + SeaweedFS`
- 数据库: `CloudNativePG`
- 监控: `Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics + blackbox-exporter`
- 日志: `Loki + Promtail`
- 备份与密钥: `Velero + Sealed Secrets`
- 发布与平台: `Harbor + GitLab + GitLab Runner + Argo CD + Argo Rollouts`
- 业务: `webapp-template`

补充说明：当前指标型 TSDB 就是 `Prometheus`；当前日志主线是 `Loki`，没有额外叠加 `ELK/OpenSearch`。

## 推荐阅读顺序

1. `http://192.168.0.108:30088`
2. `docs/ACCESS.md`
3. `docs/TEST_REPORT.md`
4. `docs/BEST_PRACTICES.md`
5. `docs/HANDOVER.md`
