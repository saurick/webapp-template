# 公网边界网关

当前 `*.saurick.space` 这组公网入口，不在 Kubernetes 集群内，而是由集群外 `lab-edge / 192.168.0.9` 上的 `Caddy` 统一反代到实验室内网服务。

当前这份网关除了 `portal / grafana / gitlab` 等集群内入口外，也正式承载：

- 集群外观察页 `observer.saurick.space -> 192.168.0.156:30088`
- 边界机本地的 `ddns-go` 控制台 `ddns.saurick.space -> 192.168.0.9:9876`

当前 `Portal` 对这条公网边界链路的入口口径是：

- `DDNS Go` 卡片：直达控制台
- `Public Gateway` 卡片：直达这份 `Caddy` runbook

## 证书口径

当前公网证书继续由 `lab-edge` 上的 `Caddy` 内建 ACME 客户端自动申请和续期。

结论：

- 当前默认 CA 继续使用 `Let's Encrypt`
- 续期协议本质上就是 `ACME`
- 但不需要再额外并行部署 `acme.sh`、手工 cron 或单独证书同步脚本

换句话说：这条链路应该收口成 `Caddy -> ACME -> Let's Encrypt`，而不是再在边界机上堆第二套证书真源。

## 当前真源

- `lab-edge` live 配置：`/etc/caddy/Caddyfile`
- 仓库模板真源：`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile`

说明：

- 仓库文件用于重建、审阅与交接
- live 生效仍以 `lab-edge` 上的 `/etc/caddy/Caddyfile` 为准
- 两者发生漂移时，应优先把 live 已验证配置回收到仓库，再统一更新 `lab-edge`
- 证书与续期状态应继续跟随 `Caddy` 的运行时状态目录；不要把手工导入的单次止血操作继续保留成长期主路径

## 为什么这份配置重要

- `portal.saurick.space` 与 `gitlab.saurick.space` 是两个不同 host
- GitLab 默认签发的 host-only session cookie 只对 `gitlab.saurick.space` 自己可见
- Portal 虽然通过 `/gitlab`、`/gitlab-api` 代理请求 GitLab，但浏览器不会自动把 `gitlab.saurick.space` 的 host-only cookie 带给 `portal.saurick.space`
- 当前稳定修复仍然是在公网网关上把 GitLab 的 `Set-Cookie` 统一补成 `Domain=.saurick.space`

## 更新 live 配置

先验证仓库模板语法：

```bash
caddy validate \
  --config /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile \
  --adapter caddyfile
```

然后覆盖 `lab-edge` live 文件并重启 systemd 服务：

```bash
scp /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile \
  root@192.168.0.9:/tmp/lab-public-caddy.Caddyfile

ssh root@192.168.0.9 '
  install -m 644 /tmp/lab-public-caddy.Caddyfile /etc/caddy/Caddyfile &&
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile &&
  systemctl restart caddy
'
```

## 最小回归

1. 验证 GitLab 登录页返回的 cookie 域：

```bash
curl --noproxy '*' -I https://gitlab.saurick.space/users/sign_in
```

期望看到：

- `_gitlab_session=...; Domain=.saurick.space`

2. 浏览器回归：

- 先打开 `https://gitlab.saurick.space/users/sign_in` 并登录
- 再打开 `https://portal.saurick.space`
- 确认 `Latest Load Test` 不再停留在 `Login GitLab`

3. 证书自动续期最小确认：

```bash
ssh root@192.168.0.9 'systemctl status --no-pager caddy'
ssh root@192.168.0.9 'journalctl -u caddy -n 100 --no-pager'
curl -6 --noproxy '*' -I https://portal.saurick.space
```

确认点：

- `caddy` 服务持续 `active`
- 日志里没有持续性的 ACME / renewal 错误
- 公网入口能正常完成 TLS 握手

补充说明：

- 当前这条公网链路的 DNS 真源由 `ddns-go` 维护 `lab.saurick.space` 的 `AAAA`，因此双栈客户端优先显式用 `curl -6`
- 若当前客户端本身没有稳定 IPv6，直接在 `lab-edge` 本机执行上述 `curl -6` 更接近真实链路；不要把本机网络出口问题误判成 `Caddy` 续签异常

4. `observer.saurick.space` 当前口径：

- `lab-edge` 网关已经正式接入 `observer.saurick.space -> 192.168.0.156:30088`
- 当前公网 DNS 采用 `observer.saurick.space CNAME -> lab.saurick.space`
- 当前正式入口是 `https://observer.saurick.space`
- 内网直连 `http://192.168.0.156:30088` 继续保留为备用入口
- `observer.saurick.space/healthz` 当前 `GET` 返回 `200 ok`，但 `HEAD` 返回 `501`；验证时不要机械用 `curl -I`

5. 当前 DDNS / 公网入口口径：

- `ddns-go` 已迁到 `lab-edge / 192.168.0.9`
- `ddns.saurick.space` 控制台入口已恢复，并重新保留在 Portal 导航里
- 现有 `observer / portal / grafana / gitlab / ...` 这组已经显式声明在 `manifests/lab-public-caddy.Caddyfile` 的公网子域，继续通过 `CNAME -> lab.saurick.space` 复用同一条解析链；不要把这句扩展理解成“所有 `*.saurick.space` 域名都会自动经过 `09`”
- `lab.saurick.space` 的动态 AAAA 现在由 `lab-edge` 自己维护，本地 Mac 不再承载这条公网链路

## 当前边界

- GitLab 整页浏览继续走 `https://gitlab.saurick.space`
- Portal 内部数据 fetch 继续走同源 `/gitlab`、`/gitlab-api`
- `https://portal.saurick.space/gitlab/users/sign_in` 仍不是可用整页登录入口，不应作为正式登录页
