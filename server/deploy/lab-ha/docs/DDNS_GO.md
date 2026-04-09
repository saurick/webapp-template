# DDNS Go

## 作用

`ddns-go` 负责维护当前公网入口链路里的动态 DNS 真源：

- 当前直接维护：`lab.saurick.space`
- 当前依赖它的入口：`portal.saurick.space`、`observer.saurick.space`、`ddns.saurick.space` 等当前显式接入 `lab-edge` 公网网关、并采用 `CNAME -> lab.saurick.space` 的子域名；不是所有 `*.saurick.space` 域名都会自动跟随它

## 当前入口

- 内网直连：`http://192.168.0.9:9876`
- 公网登录页：`https://ddns.saurick.space`

说明：

- 当前 `ddns-go` 运行在 `lab-edge / 192.168.0.9`
- Portal 内网模式会直连 `192.168.0.9:9876`
- 公网访问统一通过 `lab-edge` 上的 `Caddy` 反代到 `ddns.saurick.space`
- 登录凭据只保留在 live 配置，不写入 git

## 当前 live 文件

- 仓库 service 真源：`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-edge-ddns-go.service`
- live 配置：`/etc/ddns-go/lab-saurick.yaml`
- live systemd：`/etc/systemd/system/lab-edge-ddns-go.service`
- 日志：`journalctl -u lab-edge-ddns-go`

## 当前运行口径

- 当前边界机：`lab-edge / 192.168.0.9`
- 当前更新频率：`300s`
- 当前直接维护的域名：`lab.saurick.space`
- 当前只同步 `AAAA`：live 配置里 `ipv4.enable=false`、`ipv6.enable=true`，因此这条公网链路当前应按“IPv6 主路径”理解，而不是期待 `ddns-go` 继续维护公网 `A` 记录
- 当前依赖的解析链：当前显式接入 `lab-edge` 公网网关的这组子域，通过 `CNAME -> lab.saurick.space` 跟随它；是否属于这组域名，统一以 `manifests/lab-public-caddy.Caddyfile` 中是否声明该 host 为准
- 当前 UI 登录态继续通过哈希密码保存在 live yaml

## 最小验证

```bash
ssh root@192.168.0.9 'systemctl status --no-pager lab-edge-ddns-go'
ssh root@192.168.0.9 'journalctl -u lab-edge-ddns-go -n 50 --no-pager'
curl -fsS http://192.168.0.9:9876/login | head
curl -6 --noproxy '*' -I https://ddns.saurick.space/login
dig +short AAAA lab.saurick.space @1.1.1.1
```

说明：

- 若当前客户端网络本身没有可用 IPv6，优先改到 `lab-edge` 本机或任一具备 IPv6 的外部网络上验证；不要把“本机出不了 IPv6”误判成 `ddns-go` 没更新
- 当前更可信的外部 DNS 验证方式是 `DoH + AAAA`，例如 `https://dns.google/resolve?name=lab.saurick.space&type=AAAA`

## 边界

- `ddns-go` 只负责 DNS 真源同步，不负责 HTTPS 终止
- HTTPS 网关由同一台 `lab-edge` 上的 `Caddy` 承担，配置真源见 `PUBLIC_GATEWAY.md`
- `lab-observer` 仍然只是观察页，不承载 DDNS
