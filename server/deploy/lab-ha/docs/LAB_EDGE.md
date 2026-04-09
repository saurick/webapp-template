# Lab Edge

## 作用

`lab-edge / 192.168.0.9` 是当前实验室的公网边界机，不加入 `lab-ha` 集群。

它的职责只有两类：

- `ddns-go`：维护 `lab.saurick.space` 的动态 IPv6 真源
- `Caddy`：统一承接 `*.saurick.space` 的公网 HTTPS 入口，再反代到内网 `Portal / GitLab / Grafana / Observer / ...`

## 证书口径

`lab-edge` 上的公网证书应继续由 `Caddy` 自己管理：

- 申请 / 续期协议：`ACME`
- 默认 CA：`Let's Encrypt`
- 日常形态：跟着 `caddy.service` 自动续签

不要再额外并行维护 `acme.sh`、手工 cron、或第二套独立证书同步流程。只有在 `Caddy` 内建 ACME 明确失效且短期无法修复时，才允许临时止血；止血后也要回收到 `Caddy` 主路径。

## 不要和 Lab Observer 混淆

- `lab-edge / 192.168.0.9`：公网边界、DDNS、HTTPS 网关
- `lab-observer / 192.168.0.156`：集群外开关机观察页

`lab-observer` 负责“看状态”，`lab-edge` 负责“让公网入口活着”。两台机器角色不同，不要再把 `ddns-go` 放回 `lab-observer`，也不要让本地 Mac 继续承接公网入口。

## 当前 live 文件

- SSH：`root@192.168.0.9`
- 当前 live SSH 密码：`123456`
- `ddns-go` 配置：`/etc/ddns-go/lab-saurick.yaml`
- `ddns-go` systemd：`/etc/systemd/system/lab-edge-ddns-go.service`
- `Caddy` 配置：`/etc/caddy/Caddyfile`
- `Caddy` systemd：发行版默认 `caddy.service`

## 最小验证

```bash
ssh root@192.168.0.9 'systemctl status --no-pager lab-edge-ddns-go caddy'
ssh root@192.168.0.9 'ss -ltnp | grep -E ":80|:443|:9876"'
ssh root@192.168.0.9 'journalctl -u caddy -n 100 --no-pager'
curl --noproxy '*' -I https://portal.saurick.space
curl --noproxy '*' -I https://ddns.saurick.space/login
```
