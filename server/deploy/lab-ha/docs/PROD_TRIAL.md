# WebApp 生产试验 Runbook

## 目标

- 仅针对 `webapp-template` 做第一轮生产试验
- 不改其他项目，不替换现有 `lab` 应用
- 优先验证“安全配置 + 独立命名空间 + 回滚 + 恢复”链路
- 以资源保守为前提，避免把三台小 VM 打满后无法重启

## 目录

- `manifests/argocd-webapp-prod-trial-app.yaml`：Argo CD 应用定义
- `manifests/argocd-webapp-prod-trial-app-internal.yaml`：切换到内部域名 values overlay 的 Argo CD 应用定义
- `charts/webapp-template/values-prod-trial.yaml`：生产试验 Helm values
- `charts/webapp-template/values-prod-trial-internal.yaml`：内部域名 Helm values overlay
- `argocd/webapp-prod-trial/runtime-secret.example.yaml`：运行时 Secret 示例
- `docs/INTERNAL_DNS.md`：内部域名与内网 DNS 落地说明

## 上线边界

- 当前只验证“业务生产试验”，不是硬件级高可用
- 当前外部域名、TLS、真实告警通道、异地备份仍需按实际环境补齐
- `SeaweedFS` 继续只承担对象存储与备份对象，不承担核心业务真源

## 容量预检

首次同步前，先保守检查：

1. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf top nodes`
2. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A`
3. 确认当前集群至少还有约 `1 CPU / 2Gi memory` 的可用余量
4. 确认 `webapp-prod-trial` 命名空间里没有历史失败 Pod 残留

说明：试验清单保留 `2` 副本，并使用 `maxSurge: 1` 做滚动发布；这个余量不是调度硬门槛，而是为了给发布瞬时、探针抖动和控制面波动留缓冲。

## Secret 准备

不要把真实值写回仓库。

建议顺序：

1. 复制 `argocd/webapp-prod-trial/runtime-secret.example.yaml`
2. 改成真实值
3. 优先转成 `SealedSecret` 或在集群侧手工创建 `Secret`

至少需要：

- `postgres_dsn`
- `jwt_secret`
- `admin_username`
- `admin_password`
- `trace_endpoint`（可空；留空时默认走集群内 `jaeger.monitoring.svc.cluster.local:4318`）

## 部署步骤

1. 先创建运行时 Secret
2. 再创建 Argo CD 应用：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply \
  -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app.yaml
```

3. 在 Argo CD 中手动同步 `webapp-template-prod-trial`
4. 当前仓库默认试验 host 为 `webapp-trial.192.168.0.108.nip.io`；若后续切到正式域名，再按运维口径替换

## 内部域名优先建议

如果当前阶段先走内网访问，不急着开放公网，建议优先使用：

- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml`

操作顺序：

1. 先确认 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial-internal.yaml` 里的内部域名符合当前预期
2. 如果访问端和集群处于同一二层广播域，在本机 `hosts` 或内网 DNS 中把该域名指向 `192.168.0.120`
3. 如果访问端是通过 VPN / 子网路由去访问 `192.168.0.0/24`，先不要把“内部域名可达”建立在 `192.168.0.120` 上，而是先继续用节点 IP + NodePort 验证 Host 路由
4. `192.168.0.120` 是 `MetalLB` 分配给 `ingress-nginx` 的 VIP，不是 `node1/node2/node3` 任意一台机器的固定 IP
5. 当前阶段正式推荐入口是：`webapp-trial.lab.home.arpa` 指向 `192.168.0.7 / 108 / 128` 三条 A 记录，并统一走 `:32668`
6. 为了让 NodePort 不依赖“本机正好有 ingress pod”，当前 `ingress-nginx-controller` 已切到 `externalTrafficPolicy=Cluster`
7. 再执行：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply \
  -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml
```

完整说明见 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/INTERNAL_DNS.md`。

## 验收

至少通过下面几项再开放给真实用户：

1. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial rollout status deployment/webapp-template-prod-trial`
2. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial get pods`
3. `curl --noproxy '*' -H 'Host: webapp-trial.192.168.0.108.nip.io' http://192.168.0.108:32668/healthz`
4. `curl --noproxy '*' -H 'Host: webapp-trial.192.168.0.108.nip.io' http://192.168.0.108:32668/readyz`
5. 管理员登录、普通登录、核心接口最少走一遍
6. `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-tracing.sh`
7. 删除一个 Pod，确认流量可继续通过

如果已经切内部域名，验证命令应同步替换成真实内部 FQDN。

如果访问端不是同二层网络，先用下面这种保守验证方式：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh

curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' \
  http://192.168.0.7:32668/readyz

curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' \
  http://192.168.0.108:32668/readyz

curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' \
  http://192.168.0.128:32668/readyz
```

## 回滚

回滚顺序保持简单：

1. Argo CD 回滚到上一个稳定 revision
2. 如需强制撤回，执行：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial rollout undo deployment/webapp-template-prod-trial
```

3. 如仍异常，直接删除生产试验应用，不动现有 `webapp` 命名空间的 `lab` 应用

## 当前设计意图

- 生产试验和现有实验环境隔离，避免一次提交直接影响已有演示链路
- Argo CD 默认不启用自动同步，减少误发布风险
- 敏感配置走环境变量 Secret 注入，不继续把生产试验凭据写进 Git 清单
- 资源配额只允许这套试验最多吃掉一小块固定预算，避免把整台 VM 拖死
- `prod-trial` 默认 NetworkPolicy 只放行 PostgreSQL、DNS 和 Jaeger OTLP HTTP；后续若继续收紧 egress，不要漏掉 `monitoring` 命名空间 `4318/TCP`，否则 Jaeger UI 虽然正常，应用 trace 仍会超时
