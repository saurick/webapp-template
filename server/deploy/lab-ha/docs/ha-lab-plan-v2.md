# 实验室版高可用平台建设方案 v2
## Kubernetes + GitLab + Harbor + PostgreSQL HA + 监控日志 + GitOps

## 1. 建设目标

搭建一套实验室版高可用平台，完成以下能力打通：

- `kubeadm` 多控制面 Kubernetes 高可用集群
- `Cilium` 网络与基础服务治理
- PVC 高可用存储
- S3 兼容对象存储
- PostgreSQL 高可用
- Prometheus + Grafana 监控
- 日志平台
- GitLab 代码托管与 CI
- Harbor 镜像仓库
- Argo CD GitOps 发布
- `webapp-template` 接入、发布、故障演练与验证

> 说明：这是“实验室版 HA”。如果所有 VM 都跑在同一台物理宿主机上，宿主机仍然是单点。

---

## 2. 推荐拓扑

## 2.1 推荐方案：5 台 VM

### Kubernetes 集群节点（3 台）
- `k8s-cp1`：`4 vCPU / 8GB RAM / 100GB 系统盘 + 100GB 数据盘`
- `k8s-cp2`：`4 vCPU / 8GB RAM / 100GB 系统盘 + 100GB 数据盘`
- `k8s-cp3`：`4 vCPU / 8GB RAM / 100GB 系统盘 + 100GB 数据盘`

三台统一承担：
- `control-plane`
- `worker`

### 基础设施节点（2 台，推荐）
- `gitlab-01`：`4 vCPU / 8GB RAM / 200GB 磁盘`
- `harbor-01`：`2~4 vCPU / 4~8GB RAM / 200GB 磁盘`

> 推荐把 GitLab 和 Harbor 放在集群外，避免和业务、监控、数据库互相抢资源，也避免“集群坏了 -> 拉不到镜像/改不了代码”的自举问题。

## 2.2 如果资源更紧

可先缩成：
- 3 台 Kubernetes 节点
- GitLab 用外部现成服务
- Harbor 第二阶段再补

但如果你要“全链路自建”，建议还是按 5 台 VM 规划。

---

## 3. 组件选型

## 3.1 集群基础

- Kubernetes：`kubeadm`
- 容器运行时：`containerd`
- API 高可用：`kube-vip`
- CNI：`Cilium`
- Service LoadBalancer：`MetalLB`
- Ingress：`ingress-nginx`
- 证书：`cert-manager`

## 3.2 存储

### PVC 高可用
- `Longhorn`

用途：
- Kubernetes 持久卷
- 数据库、监控、日志等需要 PVC 的组件

### 对象存储
- `SeaweedFS`

用途：
- 作为 S3 兼容对象存储
- 用于应用接入测试
- 可作为 PostgreSQL 备份目标

> 本档资源下不建议默认上 `Rook-Ceph + RGW`，太重。

## 3.3 数据库

- PostgreSQL HA：`CloudNativePG`
- 连接池：`Pooler`
- 备份：备份到 `SeaweedFS` 或外部 S3

## 3.4 监控与日志

### 默认推荐
- 指标：`kube-prometheus-stack`
- 可视化：`Grafana`
- 日志采集：`Fluent Bit`
- 日志存储：`Loki`

### 如果你强制要求“ELK 类检索体验”
可替换或二阶段补充：
- `OpenSearch + OpenSearch Dashboards`

> 在 `3 x 4C/8G` 集群里，不建议把完整 `ELK/OpenSearch` 作为第一优先级主线。

## 3.5 CI/CD

- 代码托管：`GitLab CE`
- CI：`GitLab Runner`
- 镜像仓库：`Harbor`
- CD：`Argo CD`
- 灰度发布 / 回滚：`Argo Rollouts`

## 3.6 服务治理

默认不引入服务网格，先做轻量治理：

- `Cilium NetworkPolicy`
- `Hubble`
- `ResourceQuota`
- `LimitRange`
- `PodDisruptionBudget`
- `topologySpreadConstraints`
- `HPA`
- `requests/limits` 强制收口

> 这个规格下不建议一开始就上 `Istio`。如果后面一定要服务网格，优先考虑 `Linkerd`。

---

## 4. GitLab 与 Harbor 的定位

## 4.1 GitLab

GitLab 负责：

- 代码仓库
- Merge Request
- Pipeline
- Runner 调度
- 制品流程入口

推荐部署方式：

- 放在集群外独立 VM
- 使用 GitLab 官方安装方式
- Runner 可跟 GitLab 同机，也可拆单独 Runner VM

## 4.2 Harbor

Harbor 负责：

- 作为唯一主镜像仓库
- 镜像分项目管理
- 机器人账号
- 不可变标签
- 保留策略
- 漏洞扫描

推荐部署方式：

- 放在集群外独立 VM
- 使用官方 Harbor 安装方案
- 存储优先走本机独立磁盘

## 4.3 避免重复建设

如果用了 Harbor，建议这样分工：

- GitLab：代码 + CI
- Harbor：镜像仓库
- Argo CD：CD
- Argo Rollouts：发布策略

> 不建议同时把 GitLab Container Registry 和 Harbor 都作为主仓库，容易混乱。建议 Harbor 作为唯一镜像真源。

---

## 5. 推荐补充组件

以下组件建议纳入方案：

### 必补
- `cert-manager`
- `Alertmanager`
- `Hubble`
- `Velero`
- `Trivy Operator`

### 强烈建议补
- `Kyverno`
- `Sealed Secrets` 或 `External Secrets`
- `blackbox-exporter`

### 说明

#### `cert-manager`
- 自动签发和续期证书
- 内外部域名入口都建议纳入

#### `Alertmanager`
- Prometheus 告警出口
- 可对接飞书、钉钉、Telegram

#### `Hubble`
- 用于查看 Cilium 网络流量
- 做网络问题排查和治理验证非常有用

#### `Velero`
- 做 K8s 资源对象级备份恢复
- 不是数据库备份替代品，但必须有

#### `Trivy Operator`
- 做镜像和集群安全扫描
- 用来补漏洞可视化和基线验证

#### `Kyverno`
- 做策略治理
- 例如：
  - 禁止使用 `latest`
  - 强制必须写 `requests/limits`
  - 限制特权容器
  - 校验镜像来源只允许 Harbor

#### `Sealed Secrets / External Secrets`
- 不要把明文 secret 直接写 Git
- 实验室可先用 `Sealed Secrets`
- 若后续接 Vault/云密钥管理，再升级到 `External Secrets`

#### `blackbox-exporter`
- 对域名、HTTP、TCP、证书做外部探测
- 能补齐“业务可访问性”的监控视角

---

## 6. 推荐最终组件清单

### 集群基础
- `kubeadm`
- `containerd`
- `kube-vip`
- `Cilium`
- `MetalLB`
- `ingress-nginx`
- `cert-manager`

### 存储与数据库
- `Longhorn`
- `SeaweedFS`
- `CloudNativePG`

### 监控与日志
- `kube-prometheus-stack`
- `Grafana`
- `Alertmanager`
- `Fluent Bit`
- `Loki`
- `blackbox-exporter`

### 安全与治理
- `Kyverno`
- `Trivy Operator`
- `Sealed Secrets` 或 `External Secrets`
- `Hubble`

### CI/CD
- `GitLab CE`
- `GitLab Runner`
- `Harbor`
- `Argo CD`
- `Argo Rollouts`

### 业务应用
- `webapp-template`

---

## 7. 发布链路设计

推荐流水线：

`开发者提交代码 -> GitLab CI -> 构建镜像 -> 推送 Harbor -> 更新部署清单 -> Argo CD 同步 -> Argo Rollouts 发布 -> Prometheus/Grafana/Loki 观察 -> 验证通过`

### 建议分工

- GitLab：
  - 源码
  - CI
  - 触发构建
- Harbor：
  - 镜像存储
  - 漏洞扫描
  - Tag 策略
- Argo CD：
  - GitOps 同步
- Argo Rollouts：
  - 蓝绿 / 金丝雀 / 快速回滚

---

## 8. 网络规划建议

示例规划：

- `k8s-cp1`: `192.168.0.111`
- `k8s-cp2`: `192.168.0.112`
- `k8s-cp3`: `192.168.0.113`
- `gitlab-01`: `192.168.0.114`
- `harbor-01`: `192.168.0.115`

### VIP
- K8s API VIP：`192.168.0.110`

### MetalLB 地址池
- `192.168.0.120 - 192.168.0.130`

可用于：
- Ingress
- Grafana
- Argo CD
- 业务服务对外入口

---

## 9. 实施阶段

## 阶段 1：基础环境
- 创建 VM
- 配固定 IP / 主机名
- 配 SSH root 登录
- 挂数据盘
- 关闭 swap
- 做内核参数基线
- 配时间同步

## 阶段 2：Kubernetes HA
- 安装 containerd
- 安装 kubeadm/kubelet/kubectl
- 部署 kube-vip
- 初始化多控制面集群
- 部署 Cilium
- 验证 CoreDNS、网络、节点状态

## 阶段 3：入口与证书
- 部署 MetalLB
- 部署 ingress-nginx
- 部署 cert-manager

## 阶段 4：存储与数据库
- 部署 Longhorn
- 部署 SeaweedFS
- 部署 CloudNativePG
- 打通备份

## 阶段 5：监控与日志
- 部署 Prometheus / Grafana / Alertmanager
- 部署 Fluent Bit / Loki
- 配 blackbox-exporter
- 配基础告警

## 阶段 6：治理与安全
- 部署 Kyverno
- 部署 Trivy Operator
- 部署 Sealed Secrets 或 External Secrets
- 打通 Hubble

## 阶段 7：CI/CD
- 部署 GitLab
- 部署 GitLab Runner
- 部署 Harbor
- 部署 Argo CD
- 部署 Argo Rollouts
- 打通 GitLab -> Harbor -> Argo CD

## 阶段 8：业务接入
- 构建 `webapp-template`
- 制作 K8s 部署清单
- 接入 PostgreSQL
- 接入对象存储
- 配置 Ingress
- 做健康检查、日志、监控接入

## 阶段 9：验证与故障演练
- 节点故障
- 控制面故障
- 数据库主库故障
- 存储节点故障
- 镜像仓库/发布异常
- 错误版本发布与回滚
- 监控告警联动验证

---

## 10. 验收标准

以下能力全部通过，才算“主链路打通”：

- K8s API 通过 VIP 可访问
- 三节点集群全部 Ready
- Cilium 网络正常
- MetalLB 正常分配外部 IP
- Longhorn PVC 正常读写
- SeaweedFS 对象上传下载正常
- CloudNativePG 主从同步正常
- PostgreSQL 主库故障后自动切换正常
- Prometheus 正常采集
- Grafana 看板可用
- Loki 日志可检索
- Alertmanager 告警能送达
- GitLab Pipeline 可执行
- Harbor 可推拉镜像
- Argo CD 可同步部署
- Argo Rollouts 可回滚
- `webapp-template` 能正常访问
- `/healthz`、`/readyz` 正常
- 关键故障演练后业务可恢复

---

## 11. 故障演练清单

### Kubernetes
- 停掉一个 control-plane 节点
- 关闭一个 worker 节点
- 验证 `kubectl`、Ingress、核心服务仍可用

### PostgreSQL
- 删除 primary Pod
- 关闭 primary 所在节点
- 验证自动切主与应用恢复

### 存储
- 断开一个 Longhorn 节点
- 验证 PVC 所在业务恢复
- 验证 SeaweedFS 基本可用

### 发布链路
- 推送一个错误版本
- 验证 Argo Rollouts 检测异常
- 验证回滚成功

### 观测链路
每次演练后都检查：

- Prometheus 指标是否异常
- Grafana 是否能看到波动
- Loki 是否有完整日志
- Alertmanager 是否告警
- Hubble 是否能观察到流量变化

---

## 12. 当前不建议一开始就上

以下组件不是不能用，而是不建议在当前规格第一阶段就加入：

- `Rook-Ceph + RGW`
- 完整 `ELK`
- `Istio`
- `Keycloak`
- `SonarQube`

原因：
- 太重
- 增加运维复杂度
- 容易把实验室平台搞成“功能很多但都不稳”

---

## 13. 最终推荐定版

如果目标是“先完整打通，再做演练，再逐步逼近生产”，推荐采用：

- `kubeadm`
- `containerd`
- `kube-vip`
- `Cilium`
- `MetalLB`
- `ingress-nginx`
- `cert-manager`
- `Longhorn`
- `SeaweedFS`
- `CloudNativePG`
- `kube-prometheus-stack`
- `Grafana`
- `Alertmanager`
- `Fluent Bit`
- `Loki`
- `blackbox-exporter`
- `Kyverno`
- `Trivy Operator`
- `Sealed Secrets`
- `Velero`
- `GitLab CE`
- `GitLab Runner`
- `Harbor`
- `Argo CD`
- `Argo Rollouts`
- `webapp-template`

---

## 14. 需要你准备的信息

请按下面格式提供：

```text
k8s-node1: <IP> / root可登 / 4C8G / 100G系统盘+100G数据盘 / 是否可清机
k8s-node2: <IP> / root可登 / 4C8G / 100G系统盘+100G数据盘 / 是否可清机
k8s-node3: <IP> / root可登 / 4C8G / 100G系统盘+100G数据盘 / 是否可清机
gitlab-01: <IP> / root可登 / 4C8G / 200G / 是否可清机
harbor-01: <IP> / root可登 / 2C4G或4C8G / 200G / 是否可清机
domain: <域名，可空>
https: <是/否>
logging: <Loki默认 / 强制OpenSearch>
registry-domain: <如 harbor.example.com>
git-domain: <如 git.example.com>
```

---

## 15. 结论

推荐方案不是“把所有热门组件都塞进去”，而是：

- 用 `GitLab` 做代码与 CI
- 用 `Harbor` 做唯一镜像真源
- 用 `Argo CD + Rollouts` 做 CD 和回滚
- 用 `Longhorn + SeaweedFS + CloudNativePG` 打通有状态能力
- 用 `Prometheus + Grafana + Loki` 打通观测
- 用 `Kyverno + Trivy + Sealed Secrets + Velero` 补齐治理、安全、备份基线

这样更稳，也更适合在实验室环境里做完整联调与故障演练。
