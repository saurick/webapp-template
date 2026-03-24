# 故障排查手册

## 1. 页面打不开

### 现象

- `Portal`、`WebApp`、`Grafana`、`Harbor` 等地址打不开

### 先做这些

先看 live 页面，确认这是“入口层异常”还是“只有脚本没跑”：

- `http://192.168.0.108:30088`
- `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- `http://192.168.0.108:30081/d/lab-ha-service-governance/ha-lab-service-governance`
- `http://192.168.0.108:30081/d/lab-ha-data/ha-lab-data-and-storage`
- `http://192.168.0.108:30086`
- `http://192.168.0.108:30093`
- `https://192.168.0.108:30443`

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|Error|Pending' || true
```

```bash
for url in \
  http://192.168.0.108:30088 \
  http://192.168.0.108:30002 \
  http://192.168.0.108:30081 \
  http://192.168.0.108:30090/graph \
  http://192.168.0.108:30093 \
  https://192.168.0.108:30443/; do
  printf '== %s ==\n' "$url"
  curl -k -L -o /dev/null -s -w '%{http_code}\n' "$url"
done

bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh
```

### 判断

- 只有一个站点挂：优先看该命名空间 Pod 和 Service
- 全部挂：先看节点、`ingress-nginx`、当前访问端是否通过 VPN / 子网路由进入实验室网段

如果故障发生在“刚重启 VM / 宿主机维护恢复”之后，第一反应不要先猜业务配置，直接跑：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

这一步会优先暴露：

- 节点 swap 又被系统挂回，导致 `kubelet` 起不来
- 主机防火墙在节点重启后恢复，导致 NodePort、存储或 CNI 链路被拦
- `multipathd` 在节点上恢复为运行态，导致 Longhorn 命中官方已知问题
- `containerd` 或存储基线没恢复
- 关键 NodePort / 管理入口还没回到 `200`
- `Alert Sink / Jaeger` 这类值班留痕页是不是还在，避免误把“历史被清空”当成“系统没恢复”
- 三节点都 `Ready` 之后，是否只是残留了一批 `Unknown/Terminating` 的旧 controller Pod，导致控制器没继续收敛

如果现象不是“节点没起来”，而是：

- `kubectl get ...` 偶发 `context deadline exceeded`
- `helm-release.sh apply` 偶发 `UPGRADE FAILED: ... context deadline exceeded`
- `Portal / Prometheus / Argo CD` 这类入口偶尔一起抖一下，但 Pod 面还是 `Running`

优先再补一条节点压力检查：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-node-pressure.sh
```

重点看：

- `vmstat_st`：如果多节点 `cpu steal` 持续高于 `5%`，优先怀疑宿主机 CPU 争用
- `vmstat_wa`：如果多节点 `iowait` 持续高于 `5%`，优先怀疑宿主机或底层存储抖动
- `etcd_warn_count`：如果 `apply request took too long` 或 `leader failed to send out heartbeat` 又开始出现，说明控制面写路径正在受压

这类现象不是 chart 真源错误，更像同宿主机 VM 之间的资源争用；在底层压力没降下来前，继续反复撞 Helm 发布通常只会重复超时。

## 2. WebApp 返回 500 / `readyz` 失败

### 排查

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n webapp -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n webapp deploy/webapp-template --tail=120
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n database -l cnpg.io/cluster=app-pg -o wide
```

### 常见原因

- PG 没准备好
- 应用刚滚动发布中
- Secret / 配置不一致

### 快速修复

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf rollout status deployment/webapp-template -n webapp --timeout=300s
```

## 2.1 内部域名 `VIP` 不通，但节点入口可用

### 现象

- `http://192.168.0.120` 或 `webapp-trial.lab.home.arpa` 直连 VIP 不通
- 但 `192.168.0.7 / 108 / 128:32668` 带 `Host: webapp-trial.lab.home.arpa` 仍能返回 `200`

### 结论

- 这通常不是 `webapp` 故障
- 更常见的是访问端不在与集群相同的二层广播域，`MetalLB L2 VIP` 不能直接穿过 VPN / 子网路由到达

### 处理

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ensure-ingress-nodeport-cluster.sh
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh
```

当前阶段把正式访问口径收口为：

- `webapp-trial.lab.home.arpa`
- 多节点 A 记录：`192.168.0.7 / 108 / 128`
- 访问端口：`32668`

## 3. GitLab Pipeline 失败

### 排查

```bash
ssh root@192.168.0.108 'gitlab-runner verify'
curl -I http://192.168.0.108:8929/users/sign_in
```

### 看哪里

- 先看 GitLab pipeline 页面
- 再看 `.gitlab-ci.yml`
- 再看 Runner 连通性

### 注意

- 实验室发布链路默认以 `gitlab` 远程为准
- `origin` 仍是 GitHub 上游，不要混推

## 4. Argo CD `OutOfSync` / `ComparisonError`

### 排查

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get application -n argocd webapp-template-lab -o yaml
```

### 强制刷新

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf patch application webapp-template-lab -n argocd \
  --type merge \
  -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
```

### 常见原因

- Git 仓库内容已更新但 Argo 缓存没刷新
- Kustomize 路径冲突
- 同一资源被手工 `kubectl patch` 过，产生 drift

## 5. Harbor 异常

### 排查

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n harbor -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n harbor deploy/harbor-core --tail=120
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n harbor deploy/harbor-jobservice --tail=120
curl -u 'admin:HarborAdmin123!' http://192.168.0.108:30002/api/v2.0/users/current
```

### 常见原因

- Pod 未完全 Ready
- Redis / DB 未就绪
- 镜像拉取失败

## 6. SeaweedFS 看起来“不通”

### 先区分

- `30888`：Filer UI，给人看的
- `30333`：S3 API，给程序用的

### 浏览器打开 `30333` 报 `AccessDenied`

- 这是正常现象
- 不是故障

### 真正要排查时

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n object-storage -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n object-storage seaweedfs-filer-0 --tail=120
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n object-storage seaweedfs-volume-0 --tail=120
```

## 7. Velero 备份不可用

### 排查

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backupstoragelocation -n velero -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backups.velero.io,schedules.velero.io -n velero
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n velero deploy/velero --tail=120
```

### 常见原因

- bucket 不存在
- S3 凭据错误
- BSL 变成 `Unavailable`

## 8. 节点 `NotReady`

### 排查

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf describe node node1
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n kube-system -o wide
```

节点侧：

```bash
ssh root@192.168.0.7 'systemctl status kubelet --no-pager -l'
ssh root@192.168.0.7 'grep kubelet /var/log/syslog | tail -n 80'
ssh root@192.168.0.7 'swapon --show'
ssh root@192.168.0.7 'grep -nE "swap|swap.img" /etc/fstab'
ssh root@192.168.0.7 'ufw status; systemctl is-enabled ufw 2>/dev/null || true; systemctl is-active ufw 2>/dev/null || true'
ssh root@192.168.0.7 'systemctl is-enabled firewalld 2>/dev/null || true; systemctl is-active firewalld 2>/dev/null || true'
ssh root@192.168.0.7 'systemctl is-enabled multipathd.service 2>/dev/null || true; systemctl is-active multipathd.service 2>/dev/null || true; systemctl is-enabled multipathd.socket 2>/dev/null || true; systemctl is-active multipathd.socket 2>/dev/null || true'
```

### 针对 `NetworkPluginNotReady`

最后再做：

```bash
ssh root@192.168.0.7 'systemctl restart containerd && systemctl restart kubelet'
```

### 如果是重启后 `kubelet` 直接退出

优先看日志里是否出现：

- `running with swap on is not supported`

快速修复：

```bash
ssh root@192.168.0.7 'swapoff -a && systemctl restart kubelet'
```

如果临时修复有效，说明节点基线没有持久关闭 swap；应回到：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh node1
```

或至少把 `/etc/fstab` 里的 swap 挂载改掉，再重新执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

## 9. 全节点重启后只剩 Prometheus / Grafana / Harbor 这类 PVC 服务起不来

### 先判断是不是 Longhorn 卷卡住

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get settings.longhorn.io -n longhorn-system \
  auto-salvage auto-delete-pod-when-volume-detached-unexpectedly node-down-pod-deletion-policy -o yaml
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get volume.longhorn.io -n longhorn-system | egrep 'faulted|detached|degraded'
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get volumeattachments.longhorn.io -n longhorn-system | grep pvc-
```

### 典型现象

- 节点都已经 `Ready`
- 大多数入口都回到 `200`
- 只有 `Prometheus / Grafana / Harbor` 之类挂 `RWO PVC` 的服务一直卡着
- Pod 事件反复出现 `MountVolume.MountDevice failed ... hasn't been attached yet`
- 对应 `Longhorn Volume` 显示 `state=detached`、`robustness=faulted`

### 处理顺序

1. 先确认 `Longhorn` 基线没有退回 `node-down-pod-deletion-policy=do-nothing`
2. 删除一次卡住的 Pod，观察卷是否自动回到 `attached`
3. 同时确认三台 Longhorn 节点没有再报 `Multipathd=False`；若命中，先停掉节点侧 `multipathd.service` 与 `multipathd.socket`
4. 如果 `attachment ticket` 已存在但长期 `satisfied=false`，按 `RECOVERY_RUNBOOK.md` 第 9 节做最小人工 salvage
5. 卷恢复后，再回跑 `check-ha-lab-cold-start.sh`

### 如果卷恢复了，但一直停在 `degraded`

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes.longhorn.io -n longhorn-system -o json | jq -r '
  .items[] |
  .metadata.name as $node |
  .status.diskStatus[] |
  [$node, .storageAvailable, .storageScheduled, (.conditions[] | select(.type=="Schedulable") | .status), (.conditions[] | select(.type=="Schedulable") | .message)] |
  @tsv'
```

如果只有 `1` 个 Longhorn 节点还是 `Schedulable=True`，说明当前不是“自动恢复慢一点”，而是“已经没有足够的可调度存储节点补回第二副本”。这时要优先处理容量/调度策略，不要误判成业务还没热起来。

对当前 `200Gi` 根盘实验节点，第一优先级通常是下调 `storageReservedPercentageForDefaultDisk`，而不是先砍 `storage-minimal-available-percentage=25`。前者更像是在纠正默认盘预留过高，后者则会直接压缩根盘安全余量。

## 10. 想确认是不是“环境整体不稳”

最短判断链路：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes
curl -fsS http://192.168.0.108:32668/readyz
ssh root@192.168.0.108 'gitlab-runner verify'
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backupstoragelocation -n velero
```

这四步都过，通常说明主链路还是健康的。

## 11. 收到 `LabEndpointDown` 告警

### 去哪里看

- Alertmanager：`http://192.168.0.108:30093/#/alerts`
- Grafana 总览：`http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- Runbook：`http://192.168.0.108:8929/root/webapp-template-lab/-/blob/master/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`

### 处理顺序

1. 打开告警详情，先确认 `target` 和 `instance`
2. 点 `dashboard_url` 看值班总览是否只有单点异常
3. 如果是入口探测异常，先看同类目标是否一起失败
4. 再按本手册对应章节排查具体组件

### 判断

- 只有 `jaeger` 失败：优先看 tracing 与 blackbox，不要先怀疑业务主链路
- `grafana/prometheus/alertmanager` 一起失败：先看监控栈整体
- `webapp` 单独失败：优先看应用与数据库

## 12. 收到 `TargetDown / Kube*Down` 告警

### 去哪里看

- Alertmanager：`http://192.168.0.108:30093/#/alerts`
- Grafana 总览：`http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- 本地 Runbook：`http://192.168.0.108:8929/root/webapp-template-lab/-/blob/master/server/deploy/lab-ha/docs/TROUBLESHOOTING.md`
- 官方 Runbook：看告警里的 `upstream_runbook_url`

### 处理顺序

1. 先展开告警详情，确认 `annotations.dashboard_url` 和 `annotations.runbook_url`
2. 如果是 `TargetDown`，先看是不是单个 job/service 抖动，还是整段监控链路一起掉
3. 如果是 `KubeProxyDown / KubeSchedulerDown / KubeControllerManagerDown`，优先视为控制面或 kube-system 组件异常
4. 再回到本手册第 1 节和第 8 节，看节点、系统组件和网络层

### 备注

- 这几条高频告警现在优先跳本地实验室 runbook，便于按当前拓扑值班
- 官方 Prometheus Operator 文档仍然保留在 `upstream_runbook_url`
