# 日常巡检清单

## 目标

用最少命令确认这套 3 节点实验室 HA 环境仍处于“可访问、可发布、可恢复”的状态。

## 每日 5 分钟巡检

### 1. 先看门户与值班看板

- 打开 `http://192.168.0.108:30088`
- 打开 `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- 打开 `http://192.168.0.108:30081/d/lab-ha-data/ha-lab-data-and-storage`
- 打开 `http://192.168.0.108:30081/d/lab-ha-postgres/ha-lab-postgresql-and-backup`
- 打开 `http://192.168.0.108:30081/d/lab-ha-gitops/ha-lab-gitops-and-delivery`

正常标准：

- 页面都能打开
- Portal 摘要没有明显异常
- Grafana 看板里的关键 stat 卡片大多为绿色

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
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backups.velero.io,schedules.velero.io -n velero
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backupstoragelocation -n velero
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n monitoring deploy/alert-webhook-receiver --tail=10
```

正常标准：

- `BackupStorageLocation default` 为 `Available`
- `webapp-daily` 计划仍存在
- webhook sink 最近仍有 Alertmanager 请求记录

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
