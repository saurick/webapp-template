# DDNS Go

## 作用

`ddns-go` 负责维护当前公网入口链路里的动态 DNS 真源：

- 当前直接维护：`lab.saurick.space`
- 当前依赖它的入口：`observer.saurick.space` 等通过 `CNAME -> lab.saurick.space` 的子域名

它不在 `lab-ha` 集群里，也不应该迁到 `lab-observer`。原因很简单：

- 当前公网入口实际落在宿主机侧网关
- `lab.saurick.space` 需要跟宿主机当前真实公网地址保持一致
- `lab-observer` 只是集群外观察页，不是公网入口宿主机

## 当前入口

- 公网登录页：`https://ddns.saurick.space`
- 宿主机本地监听：`http://127.0.0.1:9876`

说明：

- `ddns-go` 当前只监听宿主机回环地址
- 公网访问统一通过宿主机 `Caddy` 反代到 `ddns.saurick.space`
- 登录凭据只保留在宿主机本地配置，不写入 git

## 当前 live 文件

- 仓库模板真源：`/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-ddns-go.plist`
- 配置：`/Users/simon/.config/ddns-go/lab-saurick.yaml`
- LaunchDaemon：`/Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist`
- 日志：`/var/log/lab-saurick-ddns-go.log`
- 公网网关：`/Users/simon/.config/lab-public/Caddyfile`

## 当前运行口径

- 当前使用宿主机系统级 `LaunchDaemon` 运行，不再依赖 GUI 登录会话
- 当前更新频率：`300s`
- 当前 web UI 只监听本机回环：`127.0.0.1:9876`
- 当前公网入口仍统一通过宿主机 `Caddy` 反代到 `https://ddns.saurick.space`
- 当前显式继承代理环境变量，避免 `Cloudflare API` 调用再隐式依赖 GUI 会话里的代理导出
- 当前不再保留旧 GUI `LaunchAgent` 文件，避免宿主机侧留下双轨入口
- 当前密码通过 `ddns-go -resetPassword` 写入本地配置，保存为哈希

## 为什么不是搬到 Lab Observer

不要把“`observer.saurick.space` 现在可用了”误读成“`ddns-go` 应该搬到 `lab-observer`”。

当前真实链路是：

1. `ddns-go` 维护 `lab.saurick.space`
2. `observer.saurick.space` 等子域名通过 `CNAME` 指向 `lab.saurick.space`
3. 宿主机 `Caddy` 再把不同子域名反代到各自内网服务

所以 `ddns-go` 的职责更接近“公网入口宿主机的 DNS 同步器”，不是“集群外观察页的附属进程”。

## 最小验证

```bash
sudo launchctl print system/com.simon.lab-saurick.ddns-go
sudo plutil -p /Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist
curl -fsS http://127.0.0.1:9876/login | head
curl --noproxy '*' -I https://ddns.saurick.space/login
tail -n 50 /var/log/lab-saurick-ddns-go.log
```

## 常见操作

重置密码：

```bash
/Users/simon/.local/bin/ddns-go \
  -c /Users/simon/.config/ddns-go/lab-saurick.yaml \
  -resetPassword 'NewStrongPasswordHere'
```

更新 live `LaunchDaemon`：

```bash
plutil -lint /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-ddns-go.plist

sudo cp /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/lab-public-ddns-go.plist \
  /Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist
sudo chown root:wheel /Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist
sudo chmod 644 /Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist

sudo launchctl bootout system /Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist || true
sudo launchctl bootstrap system /Library/LaunchDaemons/com.simon.lab-saurick.ddns-go.plist
sudo launchctl kickstart -k system/com.simon.lab-saurick.ddns-go
```

重载公网网关：

```bash
sudo launchctl kickstart -k system/com.simon.lab-saurick.caddy
```
