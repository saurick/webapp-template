# WebApp 生产试验 Runbook

## 目标

- 仅针对 `webapp-template` 做第一轮生产试验
- 不改其他项目，不替换现有 `lab` 应用
- 优先验证“安全配置 + 独立命名空间 + 回滚 + 恢复”链路
- 以资源保守为前提，避免把三台小 VM 打满后无法重启

## 目录

- `manifests/argocd-webapp-prod-trial-app.yaml`：Argo CD 应用定义
- `charts/webapp-template/values-prod-trial.yaml`：生产试验 Helm values
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

说明：当前生产试验保留 `2` 副本，并通过 `Argo Rollouts` 做蓝绿发布；发布窗口里会短时同时保留 `active 2 + preview 2` 共 `4` 个 Pod，这个余量不是调度硬门槛，而是为了给蓝绿切换、探针抖动和控制面波动留缓冲。

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
4. 当前仓库默认正式 active 入口为 `http://192.168.0.108:30089`
5. 当前仓库默认正式 preview 入口为 `http://192.168.0.108:30091`

## 蓝绿发布口径

- `webapp-template-prod-trial` 现在默认走 `Argo Rollouts` 蓝绿发布，不再是普通 `Deployment`
- 正式流量继续走 active Service：`webapp-template-prod-trial`
- 新版本先挂到 preview Service：`webapp-template-prod-trial-preview`
- 发布前置检查会直接打 active/preview 最终入口，而不是只看集群内 `ClusterIP`
- 当前默认观察窗口是 `180s`：preview 检查通过后，Rollout 仍会保留 3 分钟窗口供人工查看 Grafana、Portal 和预览入口
- 如本机已安装 `kubectl-argo-rollouts` 插件，可用下面命令实时观察：

```bash
kubectl argo rollouts -n webapp-prod-trial get rollout webapp-template-prod-trial --watch
```

- 如确认 preview 已通过，且不想等满 `180s`，可提前 promote：

```bash
kubectl argo rollouts -n webapp-prod-trial promote webapp-template-prod-trial
```

## 内部域名优先建议

如果当前阶段先走内网访问，不急着开放公网，直接给下面两个域名配置多条 A 记录即可：

- `webapp-trial.lab.home.arpa`
- `webapp-trial-preview.lab.home.arpa`

推荐解析目标：

- `192.168.0.7`
- `192.168.0.108`
- `192.168.0.128`

固定访问端口：

- active：`30089`
- preview：`30091`

这一步已经不再需要单独的 Helm overlay，也不再需要额外切 Argo Application。完整说明见 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/INTERNAL_DNS.md`。

## 验收

至少通过下面几项再开放给真实用户：

1. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial get rollout webapp-template-prod-trial`
2. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n webapp-prod-trial get svc webapp-template-prod-trial webapp-template-prod-trial-preview`
3. `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh`
4. `curl --noproxy '*' http://192.168.0.108:30089/healthz`
5. `curl --noproxy '*' http://192.168.0.108:30091/readyz`
6. 管理员登录、普通登录、核心接口最少走一遍
7. `bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-tracing.sh`
8. 打开 `Grafana -> HA Lab / GitOps & Delivery`，确认 active/preview 探测和 prod-trial 健康状态一致
9. 删除一个 Pod，确认流量可继续通过

补充说明：`check-webapp-prod-trial-bluegreen.sh` 执行完成后，会把最近一次 active / preview 烟雾检查结果同步到 Portal 摘要卡，方便值班时先看页面再决定是否重跑脚本。

如果已经切内部域名，验证命令应同步替换成真实内部 FQDN。

如果访问端不是同二层网络，先用下面这种保守验证方式：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh \
  192.168.0.7 192.168.0.108 192.168.0.128

curl --noproxy '*' http://192.168.0.7:30089/readyz
curl --noproxy '*' http://192.168.0.108:30089/readyz
curl --noproxy '*' http://192.168.0.128:30089/readyz
curl --noproxy '*' http://192.168.0.108:30091/readyz
```

## 回滚

回滚顺序保持简单：

1. Argo CD 回滚到上一个稳定 revision
2. 若本机已装 `kubectl-argo-rollouts` 插件，且当前还在观察窗口或 post-promotion 校验期，可先执行：

```bash
kubectl argo rollouts -n webapp-prod-trial abort webapp-template-prod-trial
```

3. 如仍异常，直接删除生产试验应用，不动现有 `webapp` 命名空间的 `lab` 应用

## 当前设计意图

- 生产试验和现有实验环境隔离，避免一次提交直接影响已有演示链路
- Argo CD 默认不启用自动同步，减少误发布风险
- `prod-trial` 通过蓝绿 active/preview 把“发布验证”与“日常测试联调”分开，避免直接在 `lab` 链路上试切流量
- 敏感配置走环境变量 Secret 注入，不继续把生产试验凭据写进 Git 清单
- 资源配额只允许这套试验最多吃掉一小块固定预算，避免把整台 VM 拖死
- `prod-trial` 默认 NetworkPolicy 只放行 PostgreSQL、DNS 和 Jaeger OTLP HTTP；后续若继续收紧 egress，不要漏掉 `monitoring` 命名空间 `4318/TCP`，否则 Jaeger UI 虽然正常，应用 trace 仍会超时
