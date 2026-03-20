# 3 节点实验室版高可用平台部署 Runbook

## 1. 目标

在 3 台 `Ubuntu 24.04` 节点上落地以下平台能力：

- `kubeadm` 多控制面 Kubernetes 高可用
- `Cilium` 网络与 `Hubble`
- `kube-vip` 提供 API VIP
- `MetalLB` 提供裸机 `LoadBalancer`
- `ingress-nginx` + `cert-manager`
- `Longhorn` 持久卷高可用
- `SeaweedFS` S3 兼容对象存储
- `CloudNativePG` PostgreSQL 高可用
- `Prometheus + Grafana + Alertmanager + Loki`
- `Kyverno + Trivy Operator + Sealed Secrets + Velero`
- `GitLab + GitLab Runner + Harbor + Argo CD + Argo Rollouts`
- `webapp-template` 接入验证

> 注意：该方案适用于实验室环境；若三台 VM 运行在同一宿主机上，宿主机仍为单点。

## 1.1 Helm 入口

当前实验目录的 chart 安装与升级统一走：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh repos
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply
```

说明：

- 第三方 chart 使用固定版本，和当前实验集群对齐
- 平台自定义对象通过本地 `charts/lab-platform` 交给 Helm 管理
- `webapp-template` 的 `lab / prod-trial / internal` 三种形态统一走 `charts/webapp-template`

---

## 2. 前提假设

- 3 台节点规格接近：`4 vCPU / 8GB RAM / 200GB Disk`
- 三台节点同一二层网络，可互通
- 可以修改主机名、SSH 配置、用户和防火墙
- 可以访问公网拉取镜像

建议网络示例：

- `node1`: `192.168.0.111`
- `node2`: `192.168.0.112`
- `node3`: `192.168.0.113`
- `k8s API VIP`: `192.168.0.110`
- `MetalLB pool`: `192.168.0.120-192.168.0.130`

---

## 3. 分阶段实施

## 阶段 A：节点初始化

每台机器都要完成：

1. 修改唯一主机名
2. 配静态 IP
3. 创建或启用 `root`
4. 安装 SSH 公钥，优先使用密钥免密，不建议保留 root 密码直登
5. 关闭 swap
6. 配置内核参数与模块
7. 安装基础依赖：`curl wget vim jq socat conntrack ebtables ethtool nfs-common open-iscsi`
8. 时间同步正常

验收：

- 三台节点 `hostnamectl` 正确
- `ssh root@nodeX` 免密可登录
- `swapoff -a` 后 `free -h` 中 swap 为 0 使用

---

## 阶段 B：Kubernetes HA 基线

1. 安装 `containerd`
2. 安装 `kubeadm kubelet kubectl`
3. 部署 `kube-vip`
4. 在首节点执行 `kubeadm init --control-plane-endpoint <VIP>:6443`
5. 另外两台通过 `--control-plane` 加入
6. 安装 `Cilium`
7. 验证 `CoreDNS`、节点互通、Pod 网络、Service 网络

验收：

- `kubectl get nodes` 三台 `Ready`
- `kubectl get pods -A` 核心组件正常
- `kubectl cluster-info` 通过 VIP 正常返回

---

## 阶段 C：入口层

1. 通过 Helm 部署 `MetalLB`
2. 通过 `lab-platform` chart 下发地址池与 `L2Advertisement`
3. 通过 Helm 部署 `ingress-nginx`
4. 通过 Helm 部署 `cert-manager`

验收：

- `LoadBalancer` 类型服务拿到外部 IP
- `ingress-nginx-controller` 正常对外监听

---

## 阶段 D：存储与数据库

1. 部署 `Longhorn`
2. 验证默认 `StorageClass`
3. 部署 `SeaweedFS`
4. 验证 S3 兼容读写
5. 部署 `CloudNativePG`
6. 创建 `3` 副本 PG 集群 + `pooler`
7. 备份落到 `SeaweedFS`

验收：

- PVC 可正常绑定和跨节点恢复
- S3 bucket 可上传下载
- PostgreSQL 自动选主正常

---

## 阶段 E：观测与安全治理

1. 通过 Helm 部署 `kube-prometheus-stack`
2. 通过 `lab-platform` chart 部署轻量 `Loki`
3. 通过 Helm 部署 `Promtail`
4. 部署 `Hubble`
5. 部署 `Kyverno`
6. 部署 `Trivy Operator`
7. 通过 Helm 部署 `Sealed Secrets`
8. 通过 Helm 部署 `Velero`

验收：

- Grafana 看板正常
- Pod 日志可查询
- 基础告警可触发
- 策略能拦截违规镜像或缺失资源限制的工作负载

---

## 阶段 F：CI/CD 与平台服务

1. 通过 Helm 部署 `Harbor`
2. 部署 `GitLab`
3. 部署 `GitLab Runner`
4. 通过 Helm 部署 `Argo CD`
5. 通过 Helm 部署 `Argo Rollouts`

建议：

- 若资源不足，先部署 `Harbor + Argo CD + Argo Rollouts`
- `GitLab` 最后落地，并严格限制资源

验收：

- Harbor 能推拉镜像
- GitLab Runner 能执行最小 Pipeline
- Argo CD 能同步示例应用
- Argo Rollouts 能做一次最小回滚

---

## 阶段 G：业务接入

1. 构建 `webapp-template` 镜像
2. 推送 Harbor
3. 通过 `charts/webapp-template` 准备 `lab` 或 `prod-trial` values
4. 由 Argo CD 从 Helm chart 渲染：
   - namespace
   - secret
   - deployment
   - service
   - ingress
   - `ResourceQuota / LimitRange / NetworkPolicy / PDB`
5. 接 PostgreSQL
6. 接对象存储
7. 接 Prometheus / Grafana / Loki

验收：

- `webapp-template` 页面可访问
- `/healthz`、`/readyz` 正常
- 登录 / 注册 / 管理页最小功能可用

---

## 4. 故障演练清单

## 4.1 K8s 控制面演练

- 停掉 `node1` 的 `kube-apiserver` 或直接关机
- 通过 VIP 再次执行 `kubectl get nodes`
- 预期：集群仍可操作

## 4.2 工作节点演练

- 封锁或关掉一个节点
- 观察应用 Pod 是否重调度
- 预期：业务通过 Ingress 仍可访问

## 4.3 PostgreSQL 演练

- 删除当前 primary Pod
- 查看 `CloudNativePG` 选主
- 预期：应用短暂抖动后恢复

## 4.4 存储演练

- 下线一个 Longhorn 节点
- 验证 PVC 和对象存储基础能力

## 4.5 发布回滚演练

- 发布一个错误镜像
- 观察 `Argo Rollouts`
- 触发回滚
- 预期：业务回到上一稳定版本

## 4.6 观测验证

每次演练后检查：

- Prometheus 指标是否有波动
- Grafana 是否可见异常
- Loki 是否收集到错误日志
- Alertmanager 是否收到告警

---

## 5. 最小执行顺序建议

若资源压力较大，建议按这个顺序逐步上：

1. 节点初始化
2. `kubeadm + kube-vip + Cilium`
3. `MetalLB + ingress-nginx + cert-manager`
4. `Longhorn + CloudNativePG`
5. `Prometheus + Grafana + Loki`
6. `SeaweedFS`
7. `Harbor`
8. `Argo CD + Argo Rollouts`
9. `webapp-template`
10. `GitLab + Runner`

这样可以先保证集群、存储、数据库、观测、业务验证这条主链路稳定，再补较重的代码平台。

补充命令：

```bash
ONLY=ingress-nginx bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template
ONLY=lab-platform bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply
```

---

## 6. 关键风险

- 3 台 `4C/8G` 节点承载完整平台较吃紧，必须严格配资源限制
- `GitLab` 是最容易拖垮实验室集群的组件之一
- 不建议此规格第一阶段引入 `OpenSearch/ELK` 和 `Istio`
- 所有平台服务都在同一集群时，要接受“平台自身故障影响发布链路”的实验室局限

---

## 7. 完成标准

满足以下全部条件，视为本次实验室版交付完成：

- 3 节点 K8s 集群通过 VIP 正常工作
- 存储、对象存储、PostgreSQL 高可用能力已验证
- 监控、日志、告警链路打通
- Harbor、Argo CD、Argo Rollouts 正常
- `webapp-template` 已成功部署并通过基本功能验证
- 至少完成 1 次节点故障、1 次 PG 故障、1 次发布回滚演练
