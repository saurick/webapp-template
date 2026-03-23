# 实验室最佳实践与调优说明

## 总体原则

- 优先稳定，其次可观测，再考虑“组件够不够全”
- 在 `3 x 4C/8G` 下避免重型默认值
- 能用轻量但成熟的方案，就不为“名词完整”强上重组件
- 面向人操作的复杂系统，优先补 `Portal / Dashboard / 状态摘要 / 深链`，不要只留下脚本入口
- 对值班直接有帮助且体量可控的数据，优先做轻量持久化，不默认只放内存

## 为什么当前这样选

- `Prometheus` 已经承担当前实验室的指标型 TSDB 角色，所以没有再额外引入 `VictoriaMetrics`、`Mimir`、`InfluxDB`、`TimescaleDB` 之类的时序系统；在 `3 x 4C/8G` 资源下，这样更稳、更省心。
- 不用 `ELK/OpenSearch` 主线：避免把内存压爆
- 不用 `Ceph` 主线：避免把 IO、CPU、恢复复杂度拉高
- `Loki` 改成独立轻量 deployment：避免 chart 默认缓存/sidecar 在小集群里额外吃资源
- `GitLab` 放宿主机节点侧单独运行：避免和业务集群互相抢资源
- `Harbor` 留在集群里，但关闭 `trivy`：先保可用主链路，再按需扩展扫描
- `Velero` 仅启用对象级备份：当前资源预算下优先保护 K8s 对象与配置状态，不在本轮实验默认打开 node-agent 数据面备份
- `Sealed Secrets` 作为 GitOps 场景下的密钥收口：避免把 Argo CD 仓库凭据明文写进仓库
- 浏览器访问入口优先改成 `192.168.0.108:port`：避免用户侧代理/DNS 对 `nip.io` 域名的不可控影响

## 已做调优

- 节点层：
  - 关闭 swap
  - `containerd` 切到 `SystemdCgroup=true`
  - 扩满系统 LVM
  - 预加载 `overlay`、`br_netfilter`、`iscsi_tcp`
  - 关闭 IPv6，减少镜像拉取超时
- K8s 层：
  - 统一 `kubeadm` 标准控制面
  - `kube-vip` 负责 API VIP
  - `Cilium + Hubble` 提供网络策略与网络可观测
  - 统一通过 `ingress-nginx` 对外
- 存储层：
  - `Longhorn` 默认 2 副本，兼顾数据冗余和容量
  - `SeaweedFS` 的 `idx` 改成持久卷，避免 volume pod 重建时丢索引
- 数据库层：
  - `CloudNativePG` 3 实例 + rw pooler
  - 应用连接统一走 `app-pg-rw`
- 应用层：
  - 应用镜像已经推送到 Harbor，运行态统一改为从 `harbor.192.168.0.108.nip.io:32668/library/webapp-template-server:ha-lab` 拉取
  - `requests/limits`
  - `PDB`
  - `topologySpreadConstraints`
  - `NetworkPolicy`
  - `ResourceQuota + LimitRange`
- 监控层：
  - `node-exporter`、`alertmanager`、`kube-state-metrics`
  - `blackbox-exporter` 探测所有关键入口
  - Alertmanager 默认把非 Watchdog 告警发送到实验室 webhook sink，最近 payload 持久化到小 PVC，方便 Pod 重启后继续回看
  - Jaeger 保持单实例，但把最近 traces 落到 `Badger + PVC + TTL`，避免值班线索随重启直接清空

## 值班体验与留痕

- 人工巡检、恢复和发布优先从 `Portal / Grafana / Alert Sink / Alertmanager / Argo CD` 进入，命令行主要负责确认根因和批量校验。
- 对“最近告警”“最近 traces”“最近一次 smoke/巡检摘要”这类高频值班线索，默认采用“小容量持久化 + 上限/TTL”策略，不为了留痕而引入重型外部组件。
- `emptyDir` 更适合临时日志、可重建缓存和一次性工作目录；如果一重启就让排障上下文消失，就说明放错层了。
- 单副本且挂 `RWO PVC` 的轻量工具服务（例如当前 `Alert Sink`、`Jaeger`）默认用 `Recreate` 更新策略，不要继续沿用 `RollingUpdate` 去制造卷互斥死锁。

## 资源预算建议

- `GitLab` 已经是本实验里最重的单点组件之一，默认不要再把它塞回 K8s
- `Harbor` 当前关闭 `trivy`，否则 3 节点资源会更紧
- `Prometheus` 保留 1 副本 + 5d retention，足够实验用途
- `Loki` 只保 1 副本 + 本地持久卷，不做生产级分布式
- 如果后续明确需要日志全文检索、复杂审计聚合或 Discover/Kibana 式分析，再单独评估 `OpenSearch`；当前资源档位下，`Loki + Grafana` 比 `ELK` 更符合稳定优先原则

## 后续扩展建议

- 如果节点升级到 `8C/16G`，优先补：
  - Harbor `trivy`
  - Velero + SeaweedFS S3 备份
  - Sealed Secrets
  - Kyverno 强策略
- 如果后续拿到 3 台独立宿主机，再评估：
  - 更强的对象存储冗余策略
  - GitOps 从“准备好”升级到“远端仓库自动收敛”
  - 多入口 HTTPS 和真实告警通道
