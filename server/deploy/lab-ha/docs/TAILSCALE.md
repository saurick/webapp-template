# Tailscale 外部访问 Runbook

## 目标

- 让少量固定运维人员可以从实验室外安全访问当前 `lab-ha`
- 继续保持“管理面优先内网 / tailnet 访问”，而不是直接开放公网入口
- 不改变当前业务发布真源，不把 `Tailscale` 塞进集群内作为新的主依赖

## 当前结论

- 当前推荐把 `Tailscale` 用作“外部运维访问入口”
- 当前不推荐把 `Tailscale` 当成“真实用户业务访问主路径”
- 当前默认更适合的形态是“`lab-ha` 运维入口机”：主机本身加入 tailnet，保留 `Tailscale SSH` / 跳板能力，但不默认抢现有 `192.168.0.0/24` 路由
- 只有 tailnet 里没有现成的 `192.168.0.0/24 subnet router`，或者你明确要迁移主入口时，才显式广告这条路由
- 当前不建议把 `Tailscale` 部署成集群内 Pod；优先放在集群外边界主机，实在没有再退到宿主机侧稳定节点的 host OS

## 为什么这样选

- 这套实验环境的管理面入口已经固定为 `Portal / Grafana / Headlamp / Argo CD / GitLab / Harbor`
- 外部访问真正缺的是“安全进来”的路径，而不是再加一套公网入口
- 当前 `MetalLB` 入口依赖 L2 VIP；`Tailscale` 更适合做 L3 路由，不适合拿来假装当前已经有跨网段稳定的 L2 能力
- 如果 tailnet 里已经有现成的 LAN `subnet router`，例如当前继续承担 `192.168.0.0/24` 的 `zos`，再让 `lab-ha-router` 广告同一个 `/24` 只会形成主备重叠，不会带来更清晰的入口
- 当前文档已经把生产试验入口收口为 `Cilium Gateway hostNetwork` 直出端口；已有 LAN 子路由时，`lab-ha-router` 更适合承担 Tailscale 身份和 SSH 跳板，而不是再去抢主路由

## 推荐拓扑

### 推荐路径

1. 选一台和 `192.168.0.0/24` 同网段的边界主机
2. 在那台主机的 host OS 上安装 `Tailscale`
3. 默认不广告子路由，只把这台主机变成独立的 `lab-ha` 运维入口机
4. 如果 tailnet 里已有现成的 LAN `subnet router`，继续由它负责 `192.168.0.0/24` 直达；这台新主机负责 `Tailscale SSH`、跳板和主机级运维
5. 如果 tailnet 里没有现成的 LAN 子路由，且你确实需要外部客户端直接访问整段 `192.168.0.0/24`，再显式开启 `TAILSCALE_ROUTES=192.168.0.0/24`

### 当前实验室里的优先级

1. 最优：独立边界机 / 运维机
2. 次优：宿主机侧稳定节点
3. 兜底：`node2 (192.168.0.108)` 的 host OS

说明：第三种只是当前资源受限下的折中，不代表最佳长期形态。

## 不要做的事

- 不要把 `Tailscale` 当成 WebApp 的公网业务发布方案
- 不要把 `Grafana / Argo CD / Harbor / Headlamp` 直接因为“已经有 Tailscale”就顺手暴露到公网
- 不要把 `192.168.0.120` 这个 `MetalLB L2 VIP` 当成 tailnet 客户端的稳定前提
- 不要在当前集群里新增 `tailscale` Pod、Sidecar 或 Ingress，给现有控制面再加一层故障面
- 不要启用 `Funnel` 之类把 tailnet 服务继续暴露公网的能力
- 不要为了“看起来组件完整”让两台主机长期重叠广告同一个 `/24`，却又没有明确谁是 primary

## 最小落地步骤

### 1. 准备 Tailscale 侧前提

- 在 tailnet 中预先准备一枚可复用但受限的 auth key
- 若要使用 `tag:lab-ha-router` 之类标签，先在 tailnet policy 里配置 tag owner
- 预先决定主机名，例如：`lab-ha-router`
- 如果当前 auth key 没有获准使用 `tag:lab-ha-router`，执行脚本时可临时加 `TAILSCALE_ADVERTISE_TAGS=''` 关闭 tag，再后续回到控制台补策略

### 2. 选择运维入口主机

- 首选：与实验室网段同网段的独立边界主机
- 若当前没有独立边界机，可临时使用 `root@192.168.0.108`

### 3. 执行仓库脚本

默认先把主机收口成运维入口机，不默认广告子路由：

```bash
TAILSCALE_AUTH_KEY=tskey-xxxx \
ROUTER_HOST=root@192.168.0.108 \
TAILSCALE_HOSTNAME=lab-ha-router \
TAILSCALE_ADVERTISE_TAGS=tag:lab-ha-router \
TAILSCALE_SSH=true \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh
```

如果当前 auth key 没有 tag 权限，可先用：

```bash
TAILSCALE_AUTH_KEY=tskey-xxxx \
ROUTER_HOST=root@192.168.0.108 \
TAILSCALE_ADVERTISE_TAGS='' \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh
```

也可以把 auth key 放进文件，避免直接出现在 shell history：

```bash
TAILSCALE_AUTH_KEY_FILE=~/.config/tailscale/lab-ha-router.key \
ROUTER_HOST=root@192.168.0.108 \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh
```

如果 tailnet 里没有现成 `192.168.0.0/24` 路由，或者你明确要把主入口迁到这台机器，再显式加：

```bash
TAILSCALE_AUTH_KEY=tskey-xxxx \
ROUTER_HOST=root@192.168.0.108 \
TAILSCALE_ROUTES=192.168.0.0/24 \
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh
```

脚本会完成：

- 在目标宿主机安装 `tailscale`
- 启动 `tailscaled`
- 执行 `tailscale up`
- 仅在显式设置 `TAILSCALE_ROUTES` 时，才持久开启 `net.ipv4.ip_forward=1` 并广告对应子路由

说明：当前 `lab-ha` 节点基线默认关闭 IPv6，所以在显式广告 IPv4 子路由时，首次 `tailscale up` 看到 `IPv6 forwarding is disabled` 警告是可预期现象；只做运维入口机模式时，一般不会碰到这个 warning。

### 4. 在 Tailscale 管理台确认

- 默认运维入口机模式下，只需确认设备在线、`Tailscale SSH` 状态符合预期
- 只有显式开启 `TAILSCALE_ROUTES` 时，才需要审批对应子路由
- 若用了 tags，确认 tag owner 与设备归属符合预期
- 如果 tailnet 里已经有另一台设备在主广告同一条路由，例如已有旧的 `192.168.0.0/24 subnet router`，不要默认让 `lab-ha-router` 去抢 primary route；只有在你明确要迁移主入口时，才在管理台切换主路由

## 验证方式

### 1. 默认运维入口机模式

如果 tailnet 里已经有现成的 `192.168.0.0/24 subnet router`，例如当前的 `zos`，外部客户端仍然可以继续直接访问：

```bash
for url in \
  http://192.168.0.108:30088 \
  http://192.168.0.108:30081 \
  http://192.168.0.108:30087 \
  https://192.168.0.108:30443/ \
  http://192.168.0.108:8929/users/sign_in; do
  printf '== %s ==\n' "$url"
  curl -k -L -o /dev/null -s -w '%{http_code}\n' "$url"
done
```

正常预期：

- `Portal / Grafana / Headlamp / Argo CD / GitLab` 都能返回 `200` 或登录页

如果 tailnet 里没有现成的 LAN 子路由，而你又暂时不想把 `lab-ha-router` 升格为 `subnet router`，就改走 SSH 跳板：

```bash
tailscale ping lab-ha-router
tailscale ssh root@lab-ha-router 'hostname; tailscale ip -4'
tailscale ssh -L 30088:192.168.0.108:30088 root@lab-ha-router
```

然后在本地浏览器打开 `http://127.0.0.1:30088`，或继续在 SSH 会话里执行 `curl / kubectl / helm-release.sh`。

### 2. 再验证业务入口

`Tailscale` 路由场景下，优先继续使用当前仓库已经定义好的正式 Gateway 端口口径：

```bash
curl --noproxy '*' http://webapp-trial.lab.home.arpa:30089/readyz
curl --noproxy '*' http://webapp-trial-preview.lab.home.arpa:30091/readyz

bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh \
  192.168.0.7 192.168.0.108 192.168.0.128
```

如果当前客户端没有内网 DNS，可临时用 `hosts` 固定到任一节点，再继续验证：

```text
192.168.0.108 webapp-trial.lab.home.arpa
192.168.0.108 webapp-trial-preview.lab.home.arpa
```

## 域名与 DNS 口径

- `Tailscale` 负责“把客户端带进来”，不自动接管 `webapp-trial.lab.home.arpa`
- 如果要在浏览器里继续直接访问 `webapp-trial.lab.home.arpa`，有两种常见做法：

### 做法 A：split DNS

- 在 tailnet 里为 `lab.home.arpa` 配置 split DNS
- 让它解析到你现有的内部 DNS
- 内部 DNS 再返回 `192.168.0.7 / 108 / 128` 多条 A 记录

### 做法 B：客户端临时 hosts

- 仅做小范围临时验证时，在客户端本地 `hosts` 固定到某一台节点 IP
- 这样浏览器能直接打开域名，但失去了“多节点 A 记录”的验证价值

说明：不要把 `192.168.0.120` 这条 `MetalLB` L2 VIP 当成 routed tailnet 客户端的稳定目标。

## 可选：把运维入口机升格为 subnet router

只有在下面两类场景，才建议给 `lab-ha-router` 显式加 `TAILSCALE_ROUTES=192.168.0.0/24`：

- tailnet 里没有现成 LAN `subnet router`
- 你已经决定把现有主入口从旧设备切到 `lab-ha-router`

如果只是需要一台带 tailnet 身份的运维机，默认保持当前运维入口机模式即可。

## 回退

如果本轮只是演练，后续想撤回：

```bash
ssh root@192.168.0.108 <<'EOF'
set -euo pipefail
tailscale down || true
systemctl disable --now tailscaled || true
rm -f /etc/sysctl.d/99-tailscale-subnet-router.conf
sysctl --system >/dev/null || true
EOF
```

如果这台主机后续还会继续承担外部运维入口，通常不需要删除软件包，只需执行：

```bash
ssh root@192.168.0.108 "tailscale set --advertise-routes=''"
```

把它从 `subnet router` 降回普通运维入口机即可。

## 相关文件

- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh`
- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/ACCESS.md`
- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/INTERNAL_DNS.md`
- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md`
