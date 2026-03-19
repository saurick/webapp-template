# 恢复与演练手册

## 目标

把已经验证过的实验室故障演练步骤固化下来，方便后续重复执行和回归。

## 演练前统一检查

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|Error|Pending' || true
curl -fsS http://192.168.0.108:32668/readyz
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backupstoragelocation -n velero
```

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

## 当前边界

- 这是实验室恢复手册，不是生产容灾手册
- 三台 VM 在同一宿主机上，宿主机故障不在本轮恢复能力覆盖内
- Velero 当前验证的是对象级备份，不覆盖所有 PVC 数据面的完整恢复
