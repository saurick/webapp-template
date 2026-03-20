# 故障排查手册

## 1. 页面打不开

### 现象

- `Portal`、`WebApp`、`Grafana`、`Harbor` 等地址打不开

### 先做这些

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
```

### 针对 `NetworkPluginNotReady`

最后再做：

```bash
ssh root@192.168.0.7 'systemctl restart containerd && systemctl restart kubelet'
```

## 9. 想确认是不是“环境整体不稳”

最短判断链路：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes
curl -fsS http://192.168.0.108:32668/readyz
ssh root@192.168.0.108 'gitlab-runner verify'
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get backupstoragelocation -n velero
```

这四步都过，通常说明主链路还是健康的。

## 10. 收到 `LabEndpointDown` 告警

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
