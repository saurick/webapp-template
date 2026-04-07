# 公网宿主机网关

当前 `*.saurick.space` 这组公网入口，不在 Kubernetes 集群内，而是由宿主机侧 `Caddy` 统一反代到实验室内网服务。

当前这份网关除了 `portal / grafana / gitlab` 等集群内入口外，也正式承载：

- 集群外观察页 `observer.saurick.space -> 192.168.0.156:30088`
- 宿主机本地 `ddns-go` 控制台 `ddns.saurick.space -> 127.0.0.1:9876`

## 当前真源

- 宿主机 live 配置：`/Users/simon/.config/lab-public/Caddyfile`
- 仓库模板真源：`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile`

说明：

- 仓库文件用于重建、审阅与交接
- live 生效仍以宿主机上的 `Caddyfile` 为准
- 两者发生漂移时，应优先把 live 已验证配置回收到仓库，再统一更新宿主机

## 为什么这份配置重要

- `portal.saurick.space` 与 `gitlab.saurick.space` 是两个不同 host
- GitLab 默认签发的 host-only session cookie 只对 `gitlab.saurick.space` 自己可见
- Portal 虽然通过 `/gitlab`、`/gitlab-api` 代理请求 GitLab，但浏览器不会自动把 `gitlab.saurick.space` 的 host-only cookie 带给 `portal.saurick.space`
- 当前稳定修复是在公网网关上把 GitLab 的 `Set-Cookie` 统一补成 `Domain=.saurick.space`

关键配置：

```caddyfile
(gitlab_proxy) {
	import common_headers
	reverse_proxy {args[0]} {
		header_up Host {host}
		header_down Set-Cookie "$" "; Domain=.saurick.space"
	}
}
```

这样同一浏览器先在 `https://gitlab.saurick.space` 登录后，`https://portal.saurick.space` 下的 GitLab 代理请求就能复用 `_gitlab_session`。

## 更新 live 配置

先验证仓库模板语法：

```bash
/opt/homebrew/bin/caddy validate \
  --config /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile \
  --adapter caddyfile
```

然后覆盖宿主机 live 文件并重启 `LaunchDaemon`：

```bash
cp /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-caddy.Caddyfile \
  /Users/simon/.config/lab-public/Caddyfile

sudo launchctl kickstart -k system/com.simon.lab-saurick.caddy
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

3. `observer.saurick.space` 当前口径：

- 宿主机网关已经正式接入 `observer.saurick.space -> 192.168.0.156:30088`
- 当前公网 DNS 采用 `observer.saurick.space CNAME -> lab.saurick.space`
- 因此现有 `ddns-go` 继续只维护 `lab.saurick.space` 即可，不需要单独再把 `ddns-go` 搬到 `lab-observer`
- `Let's Encrypt` 证书已经签发完成，当前正式入口是 `https://observer.saurick.space`
- 内网直连 `http://192.168.0.156:30088` 继续保留为备用入口

4. `ddns.saurick.space` 当前口径：

- 宿主机网关反代到本机回环 `127.0.0.1:9876`
- `ddns-go` 继续维护 `lab.saurick.space`
- `observer.saurick.space` 等子域名通过 `CNAME -> lab.saurick.space` 复用这条 DDNS 真源
- `ddns-go` 当前应由宿主机系统级 `LaunchDaemon` 托管，而不是 GUI `LaunchAgent`
- 当前 `ddns-go` Web 已启用登录页，但凭据只保留在宿主机本地配置，不写入 git

## 当前边界

- GitLab 整页浏览继续走 `https://gitlab.saurick.space`
- Portal 内部数据 fetch 继续走同源 `/gitlab`、`/gitlab-api`
- `https://portal.saurick.space/gitlab/users/sign_in` 仍不是可用整页登录入口，不应作为正式登录页
