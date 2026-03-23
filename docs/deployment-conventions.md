# 部署真源约定

## 目标

减少以下长期维护问题：

- 同一批资源同时存在 `Helm / Kustomize / 裸 YAML / 现场 patch` 多个真源
- 文档写的是一套，Argo CD 指的是另一套，live 集群实际跑的是第三套
- 故障后只能靠“记得当时怎么手工改过”恢复

本约定优先服务于：

- 单一真源
- 可重建
- 易交接
- 最小必要复杂度

## 当前口径

### 0. `server/deploy/compose/prod`

- 这是单机或单宿主机的 `Docker Compose` 主路径。
- 不适用本文件里的 `Helm` 真源规则，也不要求迁移到 Helm。
- 若当前项目选择 Compose 部署，应继续按 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md` 执行。

### 1. `server/deploy/dev`、`server/deploy/prod`

- 这是模板默认的通用 K8s 骨架。
- 继续保留 `Kustomize` 形态，适合派生项目初始化时按自身环境裁剪。
- 它们是“模板起点”，不是当前 `lab-ha` 实验环境的 live 真源。

### 2. `server/deploy/lab-ha`

- `lab-ha` 是当前三节点实验环境的已落地目录。
- 第三方平台组件统一走 `Helm`。
- 自定义平台资源统一由 `charts/lab-platform` 接管。
- `webapp-template` 在实验环境中的 `lab / prod-trial / internal` 三种部署形态统一由 `charts/webapp-template` 接管。
- Argo CD 在实验环境里应只指向 Helm chart 路径，不再指向旧的 `argocd/webapp*` Kustomize 目录。

## 选型规则

### 什么时候必须用 Helm

满足任一条件时，优先用 Helm：

- 资源来自第三方成熟 chart，例如 `ingress-nginx`、`kube-prometheus-stack`、`velero`、`harbor`
- 同一类资源存在多个环境变体，且差异主要体现在 values
- 需要明确 release 名、chart 版本、升级入口和回滚口径
- 资源会被 Argo CD 长期接管，且后续还要持续升级

### 什么时候可以继续用 Kustomize

满足以下场景时，可以继续用 Kustomize：

- 模板默认骨架，本身就是给派生项目二次裁剪的起点
- 资源数量少，结构稳定，主要只是做轻量 patch 或替换
- 没有明确的第三方 chart 价值，硬上 Helm 只会增加模板噪音

### 什么时候允许保留裸 YAML

只在以下场景允许：

- 作为 `charts/lab-platform/files/raw/` 的原始文件输入，由 Helm 最终接管安装
- 一次性临时演练对象、烟雾验证对象、短期排障对象
- bootstrap 阶段必须先于 Helm/Argo 存在的少量对象

不允许长期把“直接 `kubectl apply -f some.yaml` 才生效”的对象保留为主路径，而仓库里另有 Helm 或 Argo 真源。

## 单一真源规则

### 1. 同一资源只允许一个主路径

例如：

- 若 `webapp-template-prod-trial` 已由 `charts/webapp-template` 管理，就不要再维护另一份等价的 Kustomize 主清单
- 若 `ingress-nginx-controller` 的入口策略已写入 Helm values，就不要再把 `externalTrafficPolicy` 长期留在现场 patch 里

### 2. 现场 patch 只能做应急，不算完成

允许先 patch live 集群止血，但同一轮工作里必须补回仓库真源，并在 `progress.md` 记录：

- patch 了什么
- 已回收到哪个文件
- 还有没有未回收的 drift

### 3. 文档、脚本、Argo 路径必须同向

当部署主路径变化时，必须同步检查：

- Argo CD `Application.source`
- runbook / README / handover
- 巡检或验证脚本

不要出现“脚本走 Helm，文档还写 Kustomize，Argo 还指向旧目录”的三方漂移。

## `lab-ha` 的具体规则

### 第三方组件

以下组件默认由 Helm 管理：

- `cilium`
- `metallb`
- `ingress-nginx`
- `cert-manager`
- `longhorn`
- `cloudnative-pg`
- `seaweedfs`
- `kube-prometheus-stack`
- `metrics-server`
- `blackbox-exporter`
- `sealed-secrets`
- `velero`
- `promtail`
- `argo-cd`
- `argo-rollouts`
- `harbor`

统一入口：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh list
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh template
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh apply
```

### 平台级自定义资源

以下对象虽然原始内容仍保留在 `server/deploy/lab-ha/manifests/`，但安装真源已经是 `charts/lab-platform`：

- Jaeger
- Loki
- Grafana datasource 与 dashboard
- Portal
- 平台入口 `Ingress / NodePort`
- Alert webhook receiver
- Harbor UI proxy
- Argo / CNPG 额外监控对象

原因：

- 保留 `manifests/` 目录更利于文档引用和人工阅读
- 但实际安装必须通过 Helm 收口，避免形成“第二条主路径”

### WebApp 业务部署

以下形态统一走 `charts/webapp-template`：

- `lab`
- `prod-trial`
- `prod-trial internal`

环境差异通过 values 文件表达，不再新增新的 Kustomize overlay 目录作为主路径。

## 变更流程

涉及部署改动时，按这个顺序做：

1. 先确认目标资源当前主路径是 Helm、Kustomize 还是模板骨架
2. 修改对应真源，而不是先改 live 集群
3. 如必须现场应急 patch，随后同轮回收进真源
4. 跑最小渲染校验
5. 更新文档与 `progress.md`

## 最小校验要求

### Helm 路径

至少执行其中与改动相关的项：

```bash
helm lint <chart>
helm template <release> <chart> -f <values...>
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -f <rendered-yaml>
```

### Kustomize 路径

至少执行：

```bash
kubectl kustomize <dir>
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply --dry-run=server -k <dir>
```

## 不要做的事

- 不要为了“主流”而把模板里所有 K8s 文件都强行 Helm 化
- 不要在 `lab-ha` 中为同一资源保留 Helm 和等价 Kustomize 双主路径
- 不要把一次应急 patch 默认为最终方案
- 不要在没有更新 Argo 和文档的情况下，只改 live 集群
