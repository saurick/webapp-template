# 恢复与演练手册

## 目标

把已经验证过的实验室故障演练步骤固化下来，方便后续重复执行和回归。

## 演练前统一检查

先看 live 页面，不要一上来只跑脚本：

- `http://192.168.0.108:30088`
- `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- `http://192.168.0.108:30081/d/lab-ha-data/ha-lab-data-and-storage`
- `http://192.168.0.108:30086`
- `http://192.168.0.108:30093`
- `https://192.168.0.108:30443`

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|Error|Pending' || true
curl -fsS http://192.168.0.108:32668/readyz
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backupstoragelocation -n velero
```

如果刚做过节点重启、宿主机维护或全量冷启动，优先执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

说明：该脚本会先核对每台节点的 `swap / kubelet / containerd / 模块 / sysctl`，再检查 K8s、GitOps、备份与外部入口，避免只看到业务 `503` 却漏掉“swap 回挂导致 kubelet 全挂”这类根因。
补充说明：脚本执行完成后，也会同步刷新 Portal 里的“最近冷启动验收”摘要卡，方便值班人员先在页面上看到最近一次结果。

## 1. API VIP 漂移演练

### 操作

```bash
ssh root@192.168.0.7 'mv /etc/kubernetes/manifests/kube-vip.yaml /root/kube-vip.yaml.bak'
sleep 20
kubectl --request-timeout=30s --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
```

### 期望

- `kubectl` 仍能通过 VIP 正常返回
- 其他控制面节点持有 `192.168.0.110`

### 恢复

```bash
ssh root@192.168.0.7 'mv /root/kube-vip.yaml.bak /etc/kubernetes/manifests/kube-vip.yaml'
sleep 15
```

## 2. PostgreSQL 主库故障切换

### 操作

```bash
PRIMARY=$(kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n database -l cnpg.io/cluster=app-pg,cnpg.io/instanceRole=primary -o jsonpath='{.items[0].metadata.name}')
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf delete pod -n database "$PRIMARY"
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf wait --for=condition=Ready pod -n database -l cnpg.io/cluster=app-pg --timeout=300s
curl -fsS http://192.168.0.108:32668/readyz
```

### 期望

- 新主库自动选出
- `readyz` 恢复正常

## 3. WebApp Pod 恢复演练

### 操作

```bash
POD=$(kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n webapp -l app.kubernetes.io/name=webapp-template -o jsonpath='{.items[0].metadata.name}')
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf delete pod -n webapp "$POD"
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf wait --for=condition=Ready pod -n webapp -l app.kubernetes.io/name=webapp-template --timeout=300s
curl -fsS http://192.168.0.108:32668/readyz
```

### 期望

- 新 Pod 自动拉起
- Harbor 镜像路径仍可拉取
- 应用恢复正常

## 4. SeaweedFS volume 重建演练

### 操作

```bash
VOL=$(kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -n object-storage -l app.kubernetes.io/name=seaweedfs,app.kubernetes.io/component=volume -o jsonpath='{.items[0].metadata.name}')
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf delete pod -n object-storage "$VOL"
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf wait --for=condition=Ready pod -n object-storage -l app.kubernetes.io/name=seaweedfs,app.kubernetes.io/component=volume --timeout=300s
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n object-storage port-forward svc/seaweedfs-filer-client 18888:8888
```

新终端验证：

```bash
curl -fsS http://127.0.0.1:18888/lab/hello.txt
```

### 期望

- 文件仍可读
- 说明 `idx` 持久化修复仍有效

## 5. Velero 备份烟雾验证

### 创建备份

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f - <<'EOF'
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: webapp-smoke-backup-manual
  namespace: velero
spec:
  ttl: 72h0m0s
  includedNamespaces:
    - webapp
    - database
EOF
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf wait --for=jsonpath='{.status.phase}'=Completed backup/webapp-smoke-backup-manual -n velero --timeout=600s
```

### 期望

- Backup 进入 `Completed`
- `BackupStorageLocation default` 保持 `Available`

## 6. 告警出口演练

### 操作

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply -f - <<'EOF'
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: lab-webhook-smoke-manual
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: lab.webhook.manual
      rules:
        - alert: LabWebhookSmokeManual
          expr: vector(1)
          for: 0m
          labels:
            severity: warning
          annotations:
            summary: 实验室告警手动验证
EOF
sleep 75
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf logs -n monitoring deploy/alert-webhook-receiver --tail=50
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf delete prometheusrule -n monitoring lab-webhook-smoke-manual
```

### 期望

- webhook sink 日志里能看到 Alertmanager 的 `POST /`

## 7. 演练后收口

每次演练后都执行：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|Error|Pending' || true
curl -fsS http://192.168.0.108:32668/readyz
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get application -n argocd webapp-template-lab
```

如果这轮演练涉及节点重启、节点关机再启动、宿主机维护恢复或整集群冷启动，再补一次：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

补充说明：若这轮还顺手做了 prod-trial active / preview 验收，可再执行 `check-webapp-prod-trial-bluegreen.sh`，把“最近烟雾检查”卡片也刷新到 Portal。

## 8. 节点重启 / 冷启动验收

适用场景：

- 单节点 reboot 后回到集群
- 三节点顺序重启
- 宿主机维护后整套 VM 冷启动

统一验收命令：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

期望：

- 每台节点 `swap=off`
- 每台节点 `kubelet/containerd=active`
- `overlay / br_netfilter / iscsi_tcp` 已加载
- `Alert Sink` 仍能回看最近 webhook payload，`Jaeger` 不会因 Pod/节点重启把最近 traces 全清掉
- 入口 `Portal / WebApp / Grafana / Prometheus / Alertmanager / Argo CD` 返回 `200`
- `webapp-template-lab` 维持 `Synced / Healthy`
- `Velero BackupStorageLocation` 仍为 `Available`

## 当前边界

- 这是实验室恢复手册，不是生产容灾手册
- 三台 VM 在同一宿主机上，宿主机故障不在本轮恢复能力覆盖内
- Velero 当前验证的是对象级备份，不覆盖所有 PVC 数据面的完整恢复
