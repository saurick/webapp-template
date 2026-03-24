# 联调与故障演练报告

## 基线校验

- `kubectl get nodes`：3/3 `Ready`
- `webapp-template`：2 副本运行正常
- `CloudNativePG`：3 实例运行正常
- `SeaweedFS`：master / filer / volume / s3 全部运行正常
- `Prometheus / Grafana / Alertmanager / Loki / Promtail`：运行正常
- `blackbox-exporter`：对 GitLab / Harbor / Grafana / Prometheus / Alertmanager / Argo CD / Hubble / Longhorn / SeaweedFS / WebApp 的 `probe_success=1`
- `Velero`：默认 `BackupStorageLocation` 已进入 `Available`，`webapp-smoke-backup` 已 `Completed`
- `Sealed Secrets`：示例 `lab-sealed-example` 已成功解封成 `Secret`
- `Harbor / GitLab / Runner / Argo CD / Argo Rollouts`：运行正常
- `Lab Portal`：直连入口页可打开

## 业务验证

- `/healthz` 返回 `ok`
- `/readyz` 返回 `ready`
- `register` 已通过
- `login` 已通过
- `admin_login` 已通过

## 故障演练

### 1. PostgreSQL 主库故障切换

- 操作：删除当前 primary pod
- 结果：primary 从 `app-pg-1` 切换到 `app-pg-2`
- 应用验证：`/readyz` 仍正常
- 结论：通过

### 2. API VIP 漂移

- 操作：暂时移除 `node1` 的 `kube-vip` static pod
- 结果：`192.168.0.110` 漂移到其他控制面
- 验证：`kubectl get nodes` 继续通过 VIP 返回结果
- 结论：通过

### 3. SeaweedFS volume pod 重建

- 第一次演练发现 `idx` 使用 `emptyDir` 会导致 volume 重建后丢索引
- 修复：把 `volume.idx` 改为 `persistentVolumeClaim`
- 第二次演练：删除一个 `seaweedfs-volume-*` pod 后，`/lab/hello.txt` 仍可读
- 结论：修复后通过

### 4. WebApp 连通性回归

- 操作：多次调用登录接口后到 Loki 查询日志
- 结果：能查到 `webapp` 命名空间结构化日志，包含 `request_id`、`trace.id`
- 结论：通过

### 5. Harbor 镜像源回归

- 操作：把 `webapp-template` deployment 的镜像源从节点内导入镜像切换为 Harbor 地址
- 结果：deployment 成功滚动更新，两个新 pod 都从 Harbor 路径启动成功
- 业务验证：`/readyz`、登录接口均继续通过
- 结论：通过

### 6. 入口可用性探测

- 操作：启用 `blackbox-exporter`，接入 Prometheus Operator
- 结果：10 个关键入口均被采集，`probe_success=1`
- 结论：通过

### 7. 告警出口联通

- 操作：接入实验室 webhook receiver，并创建临时告警规则触发 Alertmanager 发送告警
- 结果：`alert-webhook-receiver` 收到多次来自 `Alertmanager/0.28.1` 的 POST 请求
- 结论：通过

### 8. Velero 备份烟雾测试

- 操作：创建 `webapp-smoke-backup` 备份 `webapp` 与 `database` 命名空间，并创建 `webapp-daily` 计划任务
- 结果：备份 `Completed`，共备份 66 个对象
- 结论：通过

### 9. Sealed Secrets 解封测试

- 操作：生成 `lab-sealed-example.yaml`，应用到 `webapp` 命名空间
- 结果：控制器成功解封，对应 Secret 中 `message=hello-ha`
- 结论：通过

### 10. GitLab 浏览器登录入口修复

- 操作：清理 root 用户 `password_automatically_set` 等初始化标记
- 结果：`/users/sign_in` 不再重定向到 `/admin/initial_setup/new`
- 结论：通过

### 11. 浏览器入口直连修复

- 操作：把实验室访问口径切到 `192.168.0.108:port`，并新增平台门户页
- 结果：WebApp / Harbor / Grafana / Prometheus / Alertmanager / Argo CD / Longhorn / Hubble / SeaweedFS / GitLab / Portal 均可直接访问
- 结论：通过

### 12. 三节点顺序重启演练

- 操作：依次重启 `192.168.0.7 / 192.168.0.108 / 192.168.0.128`
- 结果：整套服务最终恢复，但在重启尾巴阶段暴露出 `CloudNativePG` 主库卡在已失联实例的问题
- 修复：把 `app-pg` 主库提升到存活实例，并把 `switchoverDelay` 收口为 `30`、`stopDelay` 收口为 `60`
- 结论：通过，但必须把 CNPG 集群真源纳入仓库

### 13. 三节点同时重启 / 全量冷启动演练

- 操作：三台 VM 同时 reboot，再用统一冷启动脚本验收
- 历史问题：早期复验里，`Prometheus` 等 Longhorn 卷会在全量冷启动后停在 `faulted/detached`，还叠加过 `swap` 回挂、`multipathd` 抢占块设备、可调度存储节点不足、以及陈旧 `Unknown/Terminating` Pod 尾巴
- 修复收口：已把 `swap` 持久关闭、主机防火墙关闭、`multipathd` 关闭、Longhorn 冷启动策略、默认盘保留比例、陈旧 Pod 清理 helper 和历史旧卷回收全部纳入当前基线
- 最新复验：`2026-03-24` 再次执行真实三节点同时重启后，`check-ha-lab-cold-start.sh` 无需人工 salvage 卷、无需人工删除旧 Pod 即直接通过；随后 `verify-ha-lab-drill.sh simultaneous-reboot` 也通过，并把“最近 HA 演练”摘要写入 Portal
- 最新结果：`kubectl get pods -A` 无 `CrashLoopBackOff / Pending / Unknown / Terminating`，Longhorn 无 `faulted / degraded / unknown` 卷残留，`Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD` 六个入口均返回 `200`
- 结论：通过。当前这套环境已经可以作为“虚拟机级 HA”的同时冷启动验收基线；但边界仍然是同宿主机三台 VM，不应对外宣称成硬件级 HA

## 当前结论

- 在三台实验室 VM 上，顺序重启与全量冷启动都已经做过真实演练
- 当前全量冷启动的最新正式结论，已经能通过统一验收并刷新到 Portal 的“最近 HA 演练”卡片，不再只停留在 runbook 或现场终端里
- 当前用户侧主访问口径已经切换为 `192.168.0.108:port`，避免 `nip.io` 域名在浏览器/代理环境下失效
- 这套结果适合作为“虚拟机级 HA 基线”与后续扩展起点
- 但仍不应宣称为“硬件级高可用”
