# 访问地址与凭据

## 访问入口

说明：当前用户侧浏览器/代理环境对 `*.nip.io` 这类主机名不稳定，因此实验室对外访问已统一切到 `192.168.0.108` 的直连 `IP:Port` 方案；这是目前最稳、最直接、最少踩坑的入口口径。

- WebApp Lab: `http://192.168.0.108:32668`
- WebApp Prod-Trial Active: `http://192.168.0.108:30089`
- WebApp Prod-Trial Preview: `http://192.168.0.108:30091`
- Portal: `http://192.168.0.108:30088`
- Harbor: `http://192.168.0.108:30002`
- Grafana: `http://192.168.0.108:30081`
- Headlamp: `http://192.168.0.108:30087`
- Jaeger: `http://192.168.0.108:30686`
- Grafana Ops Dashboard: `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- Grafana K8s Workloads Dashboard: `http://192.168.0.108:30081/d/lab-ha-service-governance/ha-lab-service-governance`
- Grafana Data Dashboard: `http://192.168.0.108:30081/d/lab-ha-data/ha-lab-data-and-storage`
- Grafana PostgreSQL Dashboard: `http://192.168.0.108:30081/d/lab-ha-postgres/ha-lab-postgresql-and-backup`
- Grafana GitOps Dashboard: `http://192.168.0.108:30081/d/lab-ha-gitops/ha-lab-gitops-and-delivery`
- Prometheus: `http://192.168.0.108:30090`
- Alertmanager: `http://192.168.0.108:30093`
- Argo CD: `https://192.168.0.108:30443`
- Hubble UI: `http://192.168.0.108:30085`
- Longhorn UI: `http://192.168.0.108:30084`
- SeaweedFS Filer UI: `http://192.168.0.108:30888`
- Alert Sink: `http://192.168.0.108:30086`（最近 webhook payload 收件页）
- SeaweedFS S3: `http://192.168.0.108:30333`
- GitLab: `http://192.168.0.108:8929`

## Tracing note

- `Jaeger` 当前采用单实例 + `Badger` 本地持久化 + `7d TTL`
- Jaeger Pod 重启或升级后，最近 traces 不应再因为内存存储被直接清空；但它仍然不是长期归档平台
- 集群内默认 OTLP HTTP 入口：`jaeger.monitoring.svc.cluster.local:4318`
- Grafana 已预置 `Jaeger` datasource，并通过 `trace_link_id` 只给已采样日志展示 `View trace`，避免低采样场景点进 Jaeger 直接 `404`
- 值班排障建议口径：先在 Grafana Explore 看 Loki，再点 sampled 日志上的 `View trace` 进入 Jaeger

## Headlamp 登录说明

- Headlamp 当前走内部 `NodePort`：`http://192.168.0.108:30087`
- Headlamp 官方推荐使用 Kubernetes `ServiceAccount token` 登录
- 当前实验室已经预置 `headlamp/headlamp-admin`，可直接执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh
```

- 默认会生成一个 `24h` 临时 token；如需缩短或拉长时效，可在命令前加 `TOKEN_DURATION=8h` 之类的环境变量
- 当前这条入口面向内网/实验室使用；若后续要更大范围暴露，应再补 ingress 级 basic auth 或 OIDC，而不是裸露给更大的网络面

## S3 endpoint note

- `http://192.168.0.108:30333` is the SeaweedFS S3 API endpoint
- It is expected to return `AccessDenied` in a normal browser tab because the browser does not sign S3 requests
- For a human-friendly UI, use `http://192.168.0.108:30888`

## Portal note

- Portal is the navigation homepage for this lab environment
- It now includes a dedicated favicon and one-click copy buttons for default credentials
- It also includes an operational snapshot area for CI, GitOps, HA drills, and blackbox guidance
- It now also surfaces the latest verified backup result and alert delivery summary for faster daily checks
- It now also exposes dedicated `K8s Workloads` and `Headlamp` entries, so operators can choose between curated Grafana triage and interactive Kubernetes resource browsing

## 当前实验室默认凭据

- WebApp Lab admin: `admin / AdminLab123!`
- WebApp Lab test user: `labuser1 / LabUser123!`
- Harbor admin: `admin / HarborAdmin123!`
- Grafana admin: `admin / Grafana123!`
- Argo CD admin: `admin / aLgJjYwPdezuEzSw`
- GitLab root: `root / L4b!Runr2026#Git`

## 若后续忘记密码

- Grafana:
  - `kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d`
- Argo CD:
  - `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`
- GitLab root:
  - `ssh root@192.168.0.108 "gitlab-rails runner -e production 'puts User.find_by(username: %q[root]).username'"`
  - 如需重置密码，使用 `gitlab-rails runner` 直接写入新密码

## 集群入口与节点

- API VIP: `192.168.0.110:6443`
- ingress NodePort HTTP: `192.168.0.108:32668`
- ingress NodePort HTTPS: `192.168.0.108:30943`
- node1: `192.168.0.7`
- node2: `192.168.0.108`
- node3: `192.168.0.128`

## Git 远程建议

- `origin`: 继续保留 GitHub 模板上游
- `gitlab`: 当前实验室部署仓库，建议用于 CI/CD / Argo CD / 演练环境
- 默认不要同时推两个远程，除非明确说明

## 历史入口说明

- `*.192.168.0.108.nip.io:32668` 这组基于 Host 头的入口仍保留在集群内配置里
- 其中 `app.192.168.0.108.nip.io` 对应 `WebApp Lab`
- `webapp-trial.192.168.0.108.nip.io` 对应 `WebApp Prod-Trial Active`
- `webapp-trial-preview.192.168.0.108.nip.io` 对应 `WebApp Prod-Trial Preview`
- 但对当前浏览器环境不再作为主推荐入口
- 后续若本机代理绕过规则已修好，可再切回主机名入口
