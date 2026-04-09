# Lab Observer

## 作用

`lab-observer` 是放在集群外的一台轻量观察页，不加入 `lab-ha` 集群，也不承载业务。它的目标只有一个：

- 在整套开机 / 关机前后，持续提供一个不会跟着 `node2` 一起下线的外部视角

它优先回答的是：

- 三台节点当前是否可达
- `22/TCP` 是否已经恢复，能否视为进入稳定启动阶段
- `K8s API VIP`、`Portal`、`WebApp Lab /readyz` 是否已经回绿
- 当前推荐顺序里每台节点处于“已就绪 / 下一台 / 等待中”还是“已退出 Ready / 保持运行”
- 当前阶段 gate 是否已经过线，例如节点、固定入口、核心服务、入口检测或外部关键探针
- 当集群内 `Portal` live API 可用时，当前开机 / 关机状态是否已经由集群内页面接管

它不负责替代：

- 虚拟化平台的最终 `Powered On / Powered Off`
- 集群内 `Portal` 的工作负载级细节
- `Grafana / Headlamp / Argo CD` 的对象级排障

## 当前默认入口

- 页面（当前正式入口）：`https://observer.saurick.space`
- 页面（内网直连备用入口）：`http://192.168.0.156:30088`
- SSH：`root@192.168.0.156`
- 当前 live SSH 密码：`123456`
- 主机名：`lab-observer`

补充说明：

- `observer.saurick.space` 当前采用 `CNAME -> lab.saurick.space`
- 当前 `ddns-go + 公网 Caddy` 已迁到 `lab-edge / 192.168.0.9`
- `lab-observer` 继续只负责开关机观察页，不承载公网入口或 DDNS 真源

## 当前资源基线

- 当前 `1C1G` 足够承载这台轻量观察页
- 实测 `lab-observer.py` 常驻约 `25 MiB RSS`
- 当前主机回读约 `961 MiB` 内存里 `655 MiB available`、磁盘根分区 `24G` 里已用约 `4.1G`
- 如果后续只额外承载同量级的边界辅助进程，这个规格仍有余量；不要把它扩成第四个业务节点

## 默认探针

当前页面默认只做最小外部观察：

- `node1 / node2 / node3` 的 `ping`
- `node1 / node2 / node3` 的 `22/TCP`
- `192.168.0.110:6443` 的 `K8s API VIP` TCP
- `http://192.168.0.108:30088/` 的集群内 `Portal`
- `http://192.168.0.108:32668/readyz` 的 `WebApp Lab`

如果集群内 `Portal` 已恢复，它还会直接镜像：

- `/alert-sink-api/ops/live/cold-start`
- `/alert-sink-api/ops/live/shutdown`

所以这台页会自动分两种模式：

- `集群外探针`：当集群内 Portal 还没起来，或已经跟着 `node2` 一起下线
- `集群内 Portal live`：当 `192.168.0.108:30088` 已经接管开关机状态；此时外置页会直接展开和 Portal 同源的步骤列表与 gate 计数，而不是只留一句摘要

## 为什么还要保留集群内 Portal

不要把 `lab-observer` 当成“替代 Portal”的第二套系统。

正确分工是：

- `lab-observer`：负责“整套电源操作前后不断线”
- 集群内 `Portal`：负责“节点 / 工作负载 / 入口 / 下一台建议”的细粒度 live 状态

最小操作口径：

1. 开机 / 关机刚开始，先看 `lab-observer`
2. 当 `192.168.0.108:30088` 恢复后，切回集群内 `Portal`
3. 关到 `node2` 后，回到 `lab-observer` 或虚拟化平台继续收尾

## 安装 / 重装

从仓库所在运维机执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-lab-observer.sh
```

可选环境变量：

```bash
LAB_OBSERVER_HOST=root@192.168.0.156
LAB_OBSERVER_PORT=22
LAB_OBSERVER_LISTEN_PORT=30088
LAB_OBSERVER_SERVICE_USER=observer
```

安装脚本会做这些事：

1. 把 `lab-observer.py` 复制到远端 `/opt/lab-observer/lab_observer.py`
2. 补齐 `python3`、`curl`、`iputils-ping` 这些最小运行依赖
3. 生成 `systemd` 服务 `/etc/systemd/system/lab-observer.service`
4. 监听 `0.0.0.0:${LAB_OBSERVER_LISTEN_PORT}`
5. 启动并重试验证 `/healthz`

## 验证

### 本机健康检查

```bash
ssh root@192.168.0.156 'systemctl status lab-observer --no-pager'
ssh root@192.168.0.156 'curl -fsS http://127.0.0.1:30088/healthz'
```

### 外部连通性

```bash
curl --noproxy '*' -fsS https://observer.saurick.space/healthz
curl --noproxy '*' -fsS https://observer.saurick.space/api/status | jq .

# 内网直连备用入口
curl -fsS http://192.168.0.156:30088/healthz
curl -fsS http://192.168.0.156:30088/api/status | jq .
```

## 边界

- 这台页面当前没有接 hypervisor API，所以“已关机 / 已开机”仍主要依据外部可达性，而不是虚拟化平台电源页
- 当集群内 `Portal` 已经恢复，这台页会建议切回 `192.168.0.108:30088`
- 当 `node2` 已经下线，集群内 `Portal` 会消失；这时 `lab-observer` 继续保留外部视角，但最终 `Powered Off` 仍以虚拟化平台为准
