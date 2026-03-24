# 高性能服务器迁移基线清单

## 目标

这份清单服务于“先把当前单宿主机实验室 HA 迁到一台性能更强、抖动更小的宿主机”，不是 3 台独立物理机的硬件级 HA 采购方案。

当前目标是：

- 先消掉现有宿主机 CPU 争用与 I/O 抖动
- 保持现在这套 `3 VM + kubeadm + Longhorn + CNPG + GitLab` 的运行方式不大改
- 为后续再迁到 `3` 台独立服务器保留路径

## 当前实验室痛点

基于 `2026-03-24` 的现场观测，当前主要瓶颈不是 chart 真源或单个组件配置错误，而是宿主机资源争用：

- 三台 VM 都出现过明显 `cpu steal`
- 三台 VM 都出现过偏高 `iowait`
- `kubectl` / `helm upgrade` 偶发 `context deadline exceeded`
- `Prometheus` / `Argo CD` 这类入口会出现瞬时 `502 / TLS EOF`

这说明下一台宿主机首先要解决的是：

- CPU 核心数量不足
- 存储延迟不稳
- 根盘和数据盘混跑

## 单宿主机阶段的最低建议

说明：以下是“当前这套环境迁过去后，明显比现在稳”的采购/验收基线，不是厂商最低可开机配置。

### 宿主机硬件

- CPU：至少 `16` 个物理核心，建议 `24` 个物理核心起步
- 内存：至少 `128GiB ECC`，建议 `192GiB` 起步
- 系统盘：`2 x NVMe SSD` 做镜像，至少 `1.92TB`
- 数据盘：单独的 `NVMe SSD` 池给 K8s VM 数据盘使用；如果预算允许，优先 `2 x NVMe` 镜像或高可用阵列
- 网卡：至少 `2 x 10GbE`；若现阶段没有跨机存储网络，至少保证宿主机本地交换与 VM vSwitch 不过载
- 电源与散热：企业级冗余电源优先，避免宿主机自身成为新的不稳定源

### 宿主机虚拟化与 BIOS

- 开启 VT-x/AMD-V 与 IOMMU
- 启用宿主机电源模式为性能优先，避免 aggressive power saving
- 尽量减少 CPU overcommit；当前这套环境不建议再走“少核宿主机硬切 3 台控制面 VM + GitLab”的方式

### VM 规划建议

- `node1 / node2 / node3`
  - `6 vCPU`
  - `16GiB RAM`
  - `100GiB` 系统盘
  - `300GiB` 独立数据盘
- `gitlab`
  - `4 vCPU`
  - `8GiB RAM`
  - `200GiB` 磁盘

如果预算足够，优先再往上留余量，而不是卡死在“刚好能跑”：

- K8s 节点建议预留至少 `30%` 的 CPU / 内存余量
- GitLab 与 Harbor 这种持续占 I/O 的平台组件，尽量不要和 Longhorn 数据盘共用同一块底层磁盘

## 存储基线

### Longhorn

- Longhorn 数据优先放独立数据盘，不要继续把主路径压在根盘 `/var/lib/longhorn`
- 仍维持默认 `2` 副本基线
- 继续要求至少 `2` 个 Longhorn 节点处于 `Schedulable=True`
- 如果未来宿主机已经有独立 NVMe 数据盘，可以把 `minimal available storage percentage` 从根盘场景的保守值重新评估到 dedicated disk 口径

### PostgreSQL / CloudNativePG

- `PGDATA` 与 `pg_wal` 以后优先考虑分开存储
- 如果预算有限，至少保证 PostgreSQL 数据盘与宿主机系统盘不共用慢盘
- 后续迁移到新宿主机时，优先确认 StorageClass 支持在线扩容，避免未来再因为磁盘太小走高风险人工迁移

## 节点操作系统与 K8s 基线

迁移后不应重新发明一套节点规则，继续沿用当前已经收口过的基线：

- Ubuntu `24.04 LTS`
- `swap` 持久关闭
- `ufw / firewalld` 关闭到明确状态
- `multipathd.service / multipathd.socket` 关闭
- `open-iscsi` 安装并开机自启
- `overlay / br_netfilter / iscsi_tcp` 模块与当前 `sysctl` 基线保持一致
- `containerd + kubelet` 开机自启

另外，迁移到高性能宿主机后，建议把 Node Allocatable 这条补上：

- 为 `kubeReserved / systemReserved` 留出固定 CPU、内存和本地存储余量
- 不要把宿主机系统守护进程、`containerd`、`kubelet` 和业务 Pod 继续挤在同一份完全无保留的 allocatable 上

## 迁移前就该写好的验收线

### 宿主机层

- `check-ha-lab-node-pressure.sh` 不再持续报多节点 `cpu steal >= 5%`
- `check-ha-lab-node-pressure.sh` 不再持续报多节点 `io_wait >= 5%`
- 在低负载时段连续执行 `kubectl get nodes -o name`，不再随机出现 `context deadline exceeded`

### 集群层

- `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh` 通过
- `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/verify-ha-lab-drill.sh simultaneous-reboot` 通过
- `kubectl get pods -A` 无 `CrashLoopBackOff / Pending / Unknown / Terminating`
- Longhorn 无 `faulted / degraded / unknown` 卷残留

### 入口层

- `Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD / Headlamp` 返回 `200`
- Portal 的最近冷启动验收、最近 HA 演练、最近备份检查、最近烟雾检查摘要都正常

## 迁移顺序建议

1. 先买单台高性能宿主机，把当前 3 台 VM 原样迁过去，先解决资源争用。
2. 跑一轮 `check-ha-lab-node-pressure.sh`、`check-ha-lab-cold-start.sh`、`verify-ha-lab-drill.sh simultaneous-reboot`。
3. 确认“发布不再随机超时、控制面/API 不再抖”后，再决定是否继续采购 `3` 台独立物理服务器走硬件级 HA。

## 当前不建议

- 不建议为了“看起来更专业”先引入更重的分布式存储
- 不建议继续把 Longhorn 主路径压在根盘上
- 不建议在宿主机 CPU 核数偏少时再加更多常驻平台组件
- 不建议在尚未稳定之前，把这套环境对外表述成硬件级 HA

## 参考

- Longhorn 官方最佳实践：SSD/NVMe、专用存储网络、专用 Longhorn 磁盘、默认 `2` 副本  
  <https://longhorn.io/docs/1.10.0/best-practices/>
- CloudNativePG 存储文档：支持把 `PGDATA` 与 `pg_wal` 分开，并建议关注扩容与存储能力  
  <https://cloudnative-pg.io/documentation/1.24/storage/>
- Kubernetes 官方文档：为系统守护进程预留 `kubeReserved / systemReserved`，避免系统守护进程与业务 Pod 争抢资源  
  <https://kubernetes.io/docs/tasks/administer-cluster/reserve-compute-resources/>
