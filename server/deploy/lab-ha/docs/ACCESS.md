# 访问地址与凭据

## 访问入口

说明：当前实验室同时保留两套人类访问入口：

- 内网入口：`192.168.0.108` 的直连 `IP:Port`
- 公网入口：`*.saurick.space` 的 `HTTPS` 子域名，由集群外 `lab-edge / 192.168.0.9` 统一反代到内网服务

Portal 现在内置“内网 / 外网”访问模式切换：

- 通过内网 `IP:Port` 打开 Portal 时，默认优先使用内网链接
- 通过公网 `portal.saurick.space` 打开 Portal 时，默认优先使用外网链接
- 页面右上角可以手动切换，并记住当前浏览器上次选择
- Portal 主页上方现在还会显示“当前开机进度 / 当前关机进度”两块 live 区域，用来回答“已经恢复到哪一步 / 下一台能不能继续开”以及“现在能不能继续关下一台”
- 关机 live 卡片只覆盖到 `node2 / 192.168.0.108` 下电前；因为 Portal 自己就挂在这台节点上，轮到关闭 `node2` 时卡片会明确提示“这是最后一个可视步骤”，之后请改到虚拟化控制台继续确认
- 当前集群外公网边界机是 `lab-edge / 192.168.0.9`：它负责 `ddns-go + 公网 Caddy`，不是 `lab-observer`
- 公网 `HTTPS` 证书当前由 `lab-edge` 上的 `Caddy` 直接通过 `ACME + Let's Encrypt` 自动申请与续期，不再额外并行维护 `acme.sh`
- 现在额外有一台集群外观察页 `Lab Observer`：正式公网入口是 `https://observer.saurick.space`，内网直连备用入口是 `http://192.168.0.156:30088`。开机初期 Portal 还没起来、或关机晚期 Portal 已跟着 `node2` 下线时，先看这台外置页；它现在也会展开每台节点的当前步骤状态与 gate 计数。等 `192.168.0.108:30088` 恢复后，再切回集群内 Portal 看更细的 live 状态
- `ddns-go` 现在已经迁到 `lab-edge`，公网控制台入口恢复为 `https://ddns.saurick.space`，内网直连入口是 `http://192.168.0.9:9876`
- 当前本地 Mac 已不再承载 `ddns-go` 或公网 `Caddy`；笔记本睡眠不会再直接带掉这组 lab 公网入口
- 推荐顺序与最终验收口径仍以 `VM_POWER_SEQUENCE.md` 和 `check-ha-lab-cold-start.sh` 为准

### 内网入口

- Lab Edge DDNS Go: `http://192.168.0.9:9876`
- Lab Observer: `http://192.168.0.156:30088`
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

### 公网入口

- DDNS Go: `https://ddns.saurick.space`
- Lab Observer: `https://observer.saurick.space`
- WebApp Lab: `https://app.saurick.space`
- WebApp Prod-Trial Active: `https://lab.saurick.space`
- WebApp Prod-Trial Preview: `https://preview.saurick.space`
- Portal: `https://portal.saurick.space`
- Harbor: `https://harbor.saurick.space`
- Grafana: `https://grafana.saurick.space`
- Headlamp: `https://headlamp.saurick.space`
- Jaeger: `https://jaeger.saurick.space`
- Grafana Ops Dashboard: `https://grafana.saurick.space/d/lab-ha-overview/ha-lab-ops-overview`
- Grafana K8s Workloads Dashboard: `https://grafana.saurick.space/d/lab-ha-service-governance/ha-lab-service-governance`
- Grafana Data Dashboard: `https://grafana.saurick.space/d/lab-ha-data/ha-lab-data-and-storage`
- Grafana PostgreSQL Dashboard: `https://grafana.saurick.space/d/lab-ha-postgres/ha-lab-postgresql-and-backup`
- Grafana GitOps Dashboard: `https://grafana.saurick.space/d/lab-ha-gitops/ha-lab-gitops-and-delivery`
- Prometheus: `https://prometheus.saurick.space`
- Alertmanager: `https://alertmanager.saurick.space`
- Argo CD: `https://argocd.saurick.space`
- Hubble UI: `https://hubble.saurick.space`
- Longhorn UI: `https://longhorn.saurick.space`
- SeaweedFS Filer UI: `https://seaweedfs.saurick.space`
- Alert Sink: `https://alertsink.saurick.space`
- SeaweedFS S3: `https://s3.saurick.space`
- GitLab: `https://gitlab.saurick.space`

说明：

- 公网 `gitlab.saurick.space` 当前由 `lab-edge` 网关补写 `Set-Cookie: Domain=.saurick.space`
- 因此同一浏览器先在 `gitlab.saurick.space` 登录后，`portal.saurick.space` 下的 GitLab 代理请求现在可以复用这份登录态，不必再额外登录一次
- 若后续这条体验再次退化，先执行 `curl --noproxy '*' -I https://gitlab.saurick.space/users/sign_in`，确认 `_gitlab_session` 响应头里仍然带有 `Domain=.saurick.space`
- 当前 GitLab 管理基线默认关闭公开注册与 `usage/service ping`；若重装或手工改动后又出现首页横幅，直接执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/harden-gitlab-instance.sh
```

- 若页面仍短时间保留旧横幅，再在低峰时段显式补一轮 `RESTART_PUMA=1`，不要把 Web 重载当成默认日常动作：

```bash
RESTART_PUMA=1 \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/harden-gitlab-instance.sh
```

- 复核当前库值可执行：

```bash
ssh root@192.168.0.108 \
  "gitlab-psql -d gitlabhq_production -c \"select signup_enabled, usage_ping_enabled, usage_ping_features_enabled, usage_ping_generation_enabled, version_check_enabled, include_optional_metrics_in_service_ping, service_ping_settings from application_settings order by id desc limit 1;\""
```

## Tracing note

- `Jaeger` 当前采用单实例 + `Badger` 本地持久化 + `7d TTL`
- Jaeger Pod 重启或升级后，最近 traces 不应再因为内存存储被直接清空；但它仍然不是长期归档平台
- 集群内默认 OTLP HTTP 入口：`jaeger.monitoring.svc.cluster.local:4318`
- Grafana 已预置 `Jaeger` datasource，并通过 `trace_link_id` 只给已采样日志展示 `View trace`，避免低采样场景点进 Jaeger 直接 `404`
- 值班排障建议口径：先在 Grafana Explore 看 Loki，再点 sampled 日志上的 `View trace` 进入 Jaeger

## Headlamp 登录说明

- Headlamp 当前走内部 `NodePort`：`http://192.168.0.108:30087`
- Headlamp 官方推荐使用 Kubernetes `ServiceAccount token` 登录
- `Portal` 的默认账号区现在会直接显示一条 `Headlamp 10y token` 卡片，并提供复制按钮；该 token 不写入 git，而是从 live 集群里的 `lab-portal/lab-portal-headlamp-access` runtime Secret 读取
- 当前实验室已经预置 `headlamp/headlamp-admin`；如需重新生成 Portal 里的长时效 token，可直接执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/sync-headlamp-portal-token.sh
```

- 上述脚本默认按 `10y` 生成并同步到 Portal；当前 API server 已确认接受这条时效，实际到期时间以 Portal 卡片展示为准
- 如果只想拿一次性的临时 token，不想刷新 Portal Secret，继续执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/get-headlamp-token.sh
```

- 临时 token 默认仍是 `90d`；如需缩短或拉长时效，可在命令前加 `TOKEN_DURATION=8h`、`TOKEN_DURATION=30d`、`TOKEN_DURATION=10y` 之类的环境变量
- 当前这条入口面向内网/实验室使用；若后续要更大范围暴露，应继续在宿主机网关或统一认证层补鉴权，而不是直接放大网络面

## Tailscale 外部访问建议

- 当前如果需要让少量固定运维人员从实验室外访问，优先引入 `Tailscale` 作为外部运维入口，而不是直接把管理面做公网暴露
- 当前推荐做法是：先在集群外边界主机，或当前宿主机侧一个稳定节点上接入 `Tailscale` 作为运维入口机
- 如果 tailnet 已经有现成的 LAN `subnet router`，例如当前继续承担 `192.168.0.0/24` 的 `zos`，就保留它处理整段内网路由；`lab-ha-router` 只负责自己的 tailnet 身份、`Tailscale SSH` 和跳板访问
- 截至 `2026-04-09` 实测，`lab-ha-router` 当前的 `Tailscale SSH` 策略会要求额外网页登录校验；`tailscale ssh root@lab-ha-router` 与直接 `ssh root@100.110.51.53` 都会先弹 `login.tailscale.com` 授权链接，因此 headless 自动化优先继续复用 `zos` 的 `192.168.0.0/24` 子路由直连内网地址，或先手工完成一次网页校验
- 只有在 tailnet 里没有现成 LAN 子路由，或者你明确要迁移主入口时，才显式给 `lab-ha-router` 加 `TAILSCALE_ROUTES=192.168.0.0/24`
- 当前最小可执行入口见：

```bash
TAILSCALE_AUTH_KEY=tskey-xxxx \
ROUTER_HOST=root@192.168.0.108 \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh
```

- 如果当前没有别的 `subnet router`，需要让 tailnet 客户端直接访问整段 `192.168.0.0/24`，再显式执行：

```bash
TAILSCALE_AUTH_KEY=tskey-xxxx \
ROUTER_HOST=root@192.168.0.108 \
TAILSCALE_ROUTES=192.168.0.0/24 \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh
```

- `Tailscale` 在这套环境里解决的是“外部运维访问”，不是“真实用户业务发布”；Portal/Grafana/Headlamp/Argo CD/GitLab 这类入口优先通过 tailnet 使用
- 通过 tailnet 访问业务时，不要把某个单一 VIP 当成唯一前提；跨网段 / 路由式访问更稳的口径仍然是 `192.168.0.7 / 108 / 128 + Cilium Gateway hostNetwork 端口`
- 如果当前 auth key 没有 `tag:lab-ha-router` 权限，可临时加 `TAILSCALE_ADVERTISE_TAGS=''` 关闭 tag，待后续补好 tailnet policy 再收紧
- 如需浏览器里继续使用 `webapp-trial.lab.home.arpa` 这类内部域名，要么给 tailnet 配 split DNS，要么先在客户端本地 `hosts` 指向三台节点中的任一可达 IP
- 详细说明见 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TAILSCALE.md`

## S3 endpoint note

- `http://192.168.0.108:30333` is the SeaweedFS S3 API endpoint
- It is expected to return `AccessDenied` in a normal browser tab because the browser does not sign S3 requests
- For a human-friendly UI, use `http://192.168.0.108:30888`

## Portal note

- Portal is the navigation homepage for this lab environment
- It now supports one-click switching between internal `IP:Port` links and external `HTTPS` domain links
- It now includes a dedicated favicon and one-click copy buttons for default credentials
- It now also includes a `Headlamp 10y token` copy card, backed by a live runtime Secret instead of a git-tracked static secret
- It now also includes a `Public Gateway` entry for the `lab-edge` Caddy runbook, alongside the direct `DDNS Go` card
- It also includes an operational snapshot area for CI, GitOps, HA drills, and blackbox guidance
- It now also surfaces the latest verified backup result and alert delivery summary for faster daily checks
- It now also exposes dedicated `K8s Workloads` and `Headlamp` entries, so operators can choose between curated Grafana triage and interactive Kubernetes resource browsing
- It now also exposes live `boot progress` and `shutdown progress` cards; the shutdown card intentionally stops at the `node2` step because Portal itself goes away once `192.168.0.108` is shut down

## 当前实验室默认凭据

- WebApp Lab admin: `admin / AdminLab123!`
- WebApp Lab test user: `labuser1 / LabUser123!`
- Harbor admin: `admin / HarborAdmin123!`
- Grafana admin: `admin / Grafana123!`
- Argo CD admin: `admin / aLgJjYwPdezuEzSw`
- GitLab root: `root / L4b!Runr2026#Git`

## 当前主机 SSH 凭据

- 截至 `2026-04-09` 实测可用：
  - `lab-edge`: `root@192.168.0.9 / 123456`
  - `lab-observer`: `root@192.168.0.156 / 123456`
- 截至 `2026-04-09` 实测可用的节点 SSH 入口：
  - `node1`: `ssh root@192.168.0.7`
  - `node2`: `ssh root@192.168.0.108`
  - `node3`: `ssh root@192.168.0.128`
  - `node2 / lab-ha-router` 的 tailnet 入口：`ssh root@100.110.51.53`
- 截至 `2026-04-09` 通过内网地址做 `root` 密码 SSH 实测失败：
  - `node1`: `ssh root@192.168.0.7` 后手输 `123456` 会失败
  - `node2`: `ssh root@192.168.0.108` 后手输 `123456` 会失败
  - `node3`: `ssh root@192.168.0.128` 后手输 `123456` 会失败

说明：

- 当前只有 `lab-edge` 与 `lab-observer` 已确认可用密码登录；不要再默认假定三台集群节点也走同一条密码 SSH 入口
- 三台节点当前正确入口是 root SSH key，不是 root 密码 SSH；在这台当前工作站上，直接执行上面的 `ssh root@192.168.0.x` 已实测可用
- 仓库节点基线脚本 [ha-node-bootstrap.sh](/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/ha-node-bootstrap.sh#L250) 会先设置 `ROOT_PASSWORD` 作为本地兜底，再写入 `PermitRootLogin prohibit-password`，并安装固定 root 公钥；因此默认口径应理解为“root 有本地密码 fallback，但 SSH 主路径走 key”
- `node2` 已进一步实测：`root` 本地密码仍匹配 `123456`，但 live `sshd -T` 生效配置是 `PermitRootLogin without-password`，因此 `ssh root@192.168.0.108` 输入密码会失败；同一台机器当前也可改走 `Tailscale SSH` 入口 `ssh root@100.110.51.53`
- 当前 `lab-ha-router` 的 `100.x` 地址走的是 `Tailscale SSH`，不是普通 `sshd`；要从 tailnet 直接连这台机器时，先按上面的网页登录校验口径处理
- 这条密码口径仅适合当前实验室交接；后续如果补密钥免密、堡垒机或更细的主机密码策略，这里必须同轮更新

## 若后续忘记密码

- Grafana:
  - `kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d`
- Argo CD:
  - `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`
- GitLab root:
  - `ssh root@192.168.0.108 "gitlab-rails runner -e production 'puts User.find_by(username: %q[root]).username'"`
  - 如需重置密码，使用 `gitlab-rails runner` 直接写入新密码

## 集群入口与节点

- lab-observer: `192.168.0.156`
- API VIP: `192.168.0.110:6443`
- WebApp Lab Gateway: `192.168.0.108:32668`
- WebApp Prod-Trial Active Gateway: `192.168.0.108:30089`
- WebApp Prod-Trial Preview Gateway: `192.168.0.108:30091`
- node1: `192.168.0.7`
- node2: `192.168.0.108`
- node3: `192.168.0.128`

## Git 远程建议

- `origin`: 继续保留 GitHub 模板上游
- `gitlab`: 当前实验室部署仓库，建议用于 CI/CD / Argo CD / 演练环境
- 默认不要同时推两个远程，除非明确说明

## 当前业务入口口径

- `WebApp Lab` 直接访问 `32668`
- `WebApp Prod-Trial Active` 直接访问 `30089`
- `WebApp Prod-Trial Preview` 直接访问 `30091`
- 业务入口已经不再依赖旧的 `Host` 头路由或 `Ingress NGINX`
