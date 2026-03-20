# Cilium / Hubble 运行与排障 Runbook

## 目标

用一组最短命令快速回答下面几个问题：

- `Cilium eBPF` 的 Service datapath 是否仍在工作
- `Hubble` 是否还能看到网络流量
- 当前故障更像 `Cilium datapath`、`Service/Endpoint`，还是外部路由 / `MetalLB L2`

## 当前口径

- kubeconfig：`/Users/simon/.kube/ha-lab.conf`
- 当前集群已经开启 `kube-proxy replacement`
- 当前集群仍使用 `vxlan`，不是 native routing
- 当前对外入口仍以 `MetalLB L2` 为主，`BGP` 暂未启用

补充说明：

- 这份手册聚焦 `Cilium / Hubble / eBPF Service datapath`
- 若问题明显落在 `Argo CD`、`Harbor`、`Velero`、`CloudNativePG`，优先回到 `docs/TROUBLESHOOTING.md`
- 若问题明显是“跨子网客户端打不通 `192.168.0.120`”，优先回到 `docs/INTERNAL_DNS.md`

## 1. 30 秒快速确认

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system get pods -o wide | egrep 'cilium|hubble|kube-proxy'

kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec ds/cilium -- cilium-dbg status --verbose | \
  egrep 'KubeProxyReplacement|Routing:|Masquerading:|Hubble:|NodePort|LoadBalancer|externalIPs|HostPort'

curl --noproxy '*' -fsS http://192.168.0.108:30085/ | head -c 120
```

正常标准：

- `cilium`、`cilium-envoy`、`hubble-relay`、`hubble-ui` 都是 `Running`
- 不应再看到 live `kube-proxy` Pod
- `KubeProxyReplacement: True`
- `NodePort / LoadBalancer / externalIPs / HostPort` 都是 `Enabled`
- `Hubble UI` 返回 HTML

## 2. 快速看入口是不是 eBPF datapath 问题

```bash
for ip in 192.168.0.7 192.168.0.108 192.168.0.128; do
  printf '== %s ==\n' "$ip"
  curl --noproxy '*' -fsS -H 'Host: webapp-trial.lab.home.arpa' "http://$ip:32668/readyz"
  printf '\n'
done

curl --noproxy '*' -fsS http://192.168.0.120/readyz
```

判断：

- 三台节点 `:32668` 都通，说明 `NodePort` datapath 基本正常
- `192.168.0.120/readyz` 也通，说明 `LoadBalancer VIP` 基本正常
- 只有 `192.168.0.120` 不通，但节点 `:32668` 正常，更像 `MetalLB L2` / 客户端网络位置问题，不像 `eBPF` 坏了

## 3. 看 Cilium 实际接管了哪些 Service

### 查看 Service 视图

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec ds/cilium -- cilium-dbg service list | sed -n '1,60p'
```

### 直接看 BPF LB map

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec ds/cilium -- cilium-dbg bpf lb list | \
  egrep '192.168.0.120:80|0.0.0.0:32668|0.0.0.0:30943|30085|30090'
```

判断：

- 能看到 `192.168.0.120:80/TCP [LoadBalancer]`，说明 VIP 已进 Cilium LB map
- 能看到 `0.0.0.0:32668/TCP [NodePort]`，说明 `NodePort` 已进 Cilium LB map
- 看不到这些条目时，先回查 `cilium-dbg status --verbose`

## 4. 看 endpoint / policy 是不是源头

### 查看 endpoint 列表

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec ds/cilium -- cilium-dbg endpoint list | sed -n '1,80p'
```

### 针对 WebApp 生产试验筛一眼

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec ds/cilium -- cilium-dbg endpoint list | egrep 'webapp-prod-trial|webapp-template|STATUS'
```

判断：

- 目标 workload 对应的 endpoint 应为 `ready`
- 若 endpoint 不在列表、或状态长期不是 `ready`，优先看 Pod 与 CNI 附着过程
- 若 endpoint 存在但 `POLICY ENFORCEMENT` 为 `Enabled` 且业务不通，再继续看 drop / policy verdict

## 5. 实时看 drop / policy verdict

### 看丢包

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec -it ds/cilium -- cilium-dbg monitor --type drop -v
```

### 看策略判定

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system \
  exec -it ds/cilium -- cilium-dbg monitor --type policy-verdict -v
```

使用方式：

- 在一个终端里跑 `monitor`
- 在另一个终端里重放失败请求，例如 `curl http://192.168.0.120/readyz`
- 观察是否出现 `drop`、拒绝方向、源/目标 endpoint id

补充说明：

- 这是流式命令，会持续输出
- 优先在排障窗口短时间使用，不要长期挂着

## 6. Hubble 怎么用

### 最短入口

- UI：`http://192.168.0.108:30085`

### 先确认 relay / ui 在不在

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system get pods -o wide | egrep 'hubble-relay|hubble-ui'
```

### 先确认相关 Service

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system get svc | egrep 'hubble'
```

建议用法：

- UI 里先按 namespace 缩小范围，例如 `webapp-prod-trial`、`webapp`
- 优先看 `dropped`、`dns`、`http`、`tcp` 方向
- 若 UI 正常但看不到想要的流量，先确认请求是否真的打到了集群入口

## 7. 什么时候更像不是 Cilium 问题

更像 `Cilium datapath` 问题的现象：

- `cilium-dbg status --verbose` 显示 `KubeProxyReplacement` 不是 `True`
- `cilium-dbg bpf lb list` 看不到目标 `NodePort` / `LoadBalancer`
- 三台节点 `:32668` 都失败
- `monitor --type drop` 持续看到同一路径被丢

更像外部路由 / `MetalLB L2` 问题的现象：

- 三台节点 `:32668` 正常，但 `192.168.0.120` 失败
- 只有跨 VPN / 跨子网客户端失败，同网段客户端正常
- `cilium-dbg bpf lb list` 里已有 `LoadBalancer` 条目，但客户端还是不通

更像业务 / endpoint 问题的现象：

- `NodePort`、`LoadBalancer` 都通，但接口返回 `500`
- endpoint 存在但后端 Pod 不健康
- 应用日志里已有明确业务错误

## 8. 当前边界

当前 live 口径是：

- `eBPF` 已接管 `ClusterIP / NodePort / LoadBalancer`
- `BGP` 没开
- `routing-mode` 仍是 `tunnel`
- `MetalLB` 当前仍是 `L2Advertisement`

这意味着：

- 当前这套 runbook 主要解决“集群内 datapath 与观测性”问题
- 不解决“外部路由器如何学习 VIP / PodCIDR”问题

## 9. 回滚入口

若后续要临时退回 `kube-proxy` 路线，当前已保留备份：

- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/rollback/kube-proxy-daemonset.yaml`
- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/artifacts/rollback/kube-proxy-configmap.yaml`

同时保留当前真源：

- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/cilium-values.yaml`

回滚时不要只恢复 `kube-proxy` 而忘记同步 `Cilium` 值文件，否则会回到双路径混跑状态。
