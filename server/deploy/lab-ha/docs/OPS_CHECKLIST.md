# 日常巡检清单

## 目标

用最少命令确认这套 3 节点实验室 HA 环境仍处于“可访问、可发布、可恢复”的状态。

如果刚做过节点重启、宿主机维护或整集群冷启动，先执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

## 每日 5 分钟巡检

### 1. 先看门户与值班看板

- 打开 `http://192.168.0.108:30088`
- 打开 `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- 打开 `http://192.168.0.108:30081/d/lab-ha-data/ha-lab-data-and-storage`
- 打开 `http://192.168.0.108:30081/d/lab-ha-postgres/ha-lab-postgresql-and-backup`
- 打开 `http://192.168.0.108:30081/d/lab-ha-gitops/ha-lab-gitops-and-delivery`
- 打开 `http://192.168.0.108:30086`
- 打开 `http://192.168.0.108:30686`

正常标准：

- 页面都能打开
- Portal 摘要没有明显异常
- Portal 里的“最近冷启动验收 / 最近备份检查 / 最近烟雾检查”不是空白或长期过期
- Grafana 看板里的关键 stat 卡片大多为绿色
- `Alert Sink` 能看到最近 webhook payload
- `Jaeger` 页面可打开，且重启后不再因为内存存储被清空最近 traces

### 2. 看 K8s 基线状态

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|Error|Pending' || true
```

正常标准：

- 3 个节点都是 `Ready`
- 没有关键命名空间异常 Pod

### 3. 看入口是否可用

```bash
for url in \
  http://192.168.0.108:30088 \
  http://192.168.0.108:32668 \
  http://192.168.0.108:30002 \
  http://192.168.0.108:30081 \
  http://192.168.0.108:30090/graph \
  http://192.168.0.108:30093 \
  https://192.168.0.108:30443/ \
  http://192.168.0.108:30084 \
  http://192.168.0.108:30085 \
  http://192.168.0.108:30888 \
  http://192.168.0.108:30086 \
  http://192.168.0.108:8929/users/sign_in; do
  printf '== %s ==\n' "$url"
  curl -k -L -o /dev/null -s -w '%{http_code}\n' "$url"
done
```

正常标准：

- 大部分入口返回 `200`
- `SeaweedFS S3` 的 `http://192.168.0.108:30333` 不纳入网页巡检；它是 API 端口

### 4. 看应用与数据面

```bash
curl -fsS http://192.168.0.108:32668/readyz
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n database -l cnpg.io/cluster=app-pg -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n object-storage -o wide
```

正常标准：

- `readyz` 返回 `ready`
- `database` 3 个 PG 实例都在跑
- `object-storage` 的 `master/filer/volume/s3` 都在跑

### 5. 看 GitOps 与 CI

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get application -n argocd webapp-template-lab
ssh root@192.168.0.108 'gitlab-runner verify'
```

正常标准：

- Argo CD 应用为 `Synced` / `Healthy`
- GitLab Runner 回显 `is alive`

### 6. 看备份和告警出口

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-velero-backup-status.sh
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n monitoring deploy/alert-webhook-receiver --tail=10
```

正常标准：

- `BackupStorageLocation default` 为 `Available`
- `webapp-daily` 计划仍存在
- 最近一次备份检查会自动刷新到 Portal 摘要卡
- webhook sink 最近仍有 Alertmanager 请求记录

补充说明：

- 打开 `http://192.168.0.108:30093/#/alerts` 查看活跃告警
- `LabEndpointDown` 现在会直接带 `dashboard_url` 与 `runbook_url`
- `TargetDown / KubeProxyDown / KubeSchedulerDown / KubeControllerManagerDown` 也已补本地 `dashboard_url` 与 `runbook_url`
- 值班时优先按“告警 -> Grafana 总览 -> Runbook”顺序处理

## 每周巡检

### 1. 看黑盒探测最小成功率

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n monitoring port-forward svc/kube-prometheus-stack-prometheus 19090:9090
curl -sG 'http://127.0.0.1:19090/api/v1/query' \
  --data-urlencode 'query=min(probe_success{job="blackbox-exporter-prometheus-blackbox-exporter"})'
```

正常标准：

- 返回值为 `1`

### 2. 抽样做一次轻量故障演练

- API VIP 漂移
- PG primary 删除后自动切主
- 删除一个 WebApp Pod 后自动恢复

执行顺序见 `server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md`

## 不要做的事

- 不要在实验室环境里默认加更多重型组件，只为了“更完整”
- 不要把 `30333` 当作网页入口排障
- 不要在未确认影响范围前随意 `kubeadm reset`、删库、删 PVC
