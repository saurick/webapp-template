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
- 结果：节点基线、GitOps、备份和大多数入口均可恢复；但 `Prometheus` 的 Longhorn 卷曾停在 `faulted/detached`
- 修复：补齐 `Longhorn` 冷启动策略基线，把 `node-down-pod-deletion-policy` 收口为 `delete-both-statefulset-and-deployment-pod`；随后继续排查发现三台节点都运行着 `multipathd`，Longhorn 节点条件明确报 `Multipathd=False`，因此又把 `multipathd` 纳入节点基线并在现场关闭，最后再对残留 `faulted` 卷做最小人工 salvage
- 复验：再次执行真实三节点同时重启后，`Longhorn Multipathd` 条件已经恢复为 `True`，说明 `multipathd` 这条已知问题已被消除；但 `Longhorn` 仍会把一批卷打成 `faulted`，最终还是要靠最小人工 salvage 才能把 `Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD` 全部拉回 `200`
- 结论：通过，但也证明“整集群同时冷启动”目前仍存在存储恢复尾巴；`multipathd` 是必须收口的节点基线，不是让冷启动自动恢复的最终答案，不能只拿运行中故障演练替代冷启动验收

## 当前结论

- 在三台实验室 VM 上，顺序重启与全量冷启动都已经做过真实演练
- 当前用户侧主访问口径已经切换为 `192.168.0.108:port`，避免 `nip.io` 域名在浏览器/代理环境下失效
- 这套结果适合作为“虚拟机级 HA 基线”与后续扩展起点
- 但仍不应宣称为“硬件级高可用”
