# VM 关机 / 开机顺序与影响

## 适用范围

这份文档只说明当前 `lab-ha` 三台实验室虚拟机在虚拟化管理层面的计划性关机、开机与重启顺序。

- 适用于任意虚拟化管理平台、`virsh`、VNC、SSH 等入口发起的 VM 电源操作
- 适用于计划性维护、宿主机重启、整套实验环境停机
- 不替代 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md` 的故障恢复步骤

## 当前固定映射

如果宿主机显示名已改成 `lab-cp-01/02/03`，当前推荐固定对应关系如下：

| 宿主机显示名 | K8s 节点名 | 固定 IP | 说明 |
| --- | --- | --- | --- |
| `lab-cp-01` | `node1` | `192.168.0.7` | 控制面节点 |
| `lab-cp-02` | `node2` | `192.168.0.108` | 固定外部管理入口节点 |
| `lab-cp-03` | `node3` | `192.168.0.128` | 控制面节点 |

补充说明：

- `192.168.0.110` 是 `kube-vip` 提供的 `K8s API VIP`，不是某台节点的固定主 IP
- 这三台都是 `control-plane + etcd` 节点，不存在永久“主/从”
- `API VIP` 持有者和 `etcd leader` 都会漂移，不要把某台 VM 永久命名成 `master`

## 先理解影响

| 操作场景 | 是否允许 | 直接影响 |
| --- | --- | --- |
| 只关 1 台 | 允许 | `etcd` 仍有 `2/3` quorum，集群通常可继续工作，但若关的是当前 `VIP` 持有者或固定入口节点，会有短暂抖动 |
| 同时关 2 台 | 不建议 | `etcd` 失去 quorum，`kubectl / Argo CD / Helm` 大概率不可用 |
| 三台都关 | 允许，但属于整套停机 | 所有入口整体中断，恢复后需要做一次正式冷启动验收 |

额外注意：

- 关闭 `lab-cp-02 / 192.168.0.108` 时，`Portal / GitLab / Harbor / Argo CD` 这些当前固定在 `192.168.0.108:Port` 的管理入口会直接不可达，即使底层 K8s 仍可能活着
- 关闭当前 `API VIP` 持有者时，`192.168.0.110:6443` 会漂移到其他节点，`kubectl` 可能短暂抖动
- 关闭当前 `etcd leader` 时，会发生一次 leader 切换，控制面通常可恢复，但比关闭 follower 的扰动更大

## 值班速查

先看 `Portal` 上方的“当前开机进度 / 当前关机进度”卡片：

- `http://192.168.0.108:30088`
- 开机卡片会直接显示“已就绪节点 / 核心服务 / 关键入口”以及“下一台建议”
- 关机卡片会直接显示“已退出 Ready 的节点 / 剩余节点与入口是否稳定 / 下一台建议”
- 关机卡片只覆盖到 `node2 / 192.168.0.108` 下电前；轮到关闭 `node2` 时，Portal 会明确提示“这是最后一个可视步骤”，因为 Portal 自己也会一起下线
- 这两块 live 卡片适合回答“现在能不能继续开/关下一台”；最终正式收口仍以本文、虚拟化电源状态和 `check-ha-lab-cold-start.sh` 为准

| 场景 | 先做什么 | 看到什么算正常 | 什么时候不要继续点下一台 |
| --- | --- | --- | --- |
| 单台计划维护 | 优先动当前非 `VIP` 持有者、非 `etcd leader` 的节点；未知时先动 `192.168.0.7` | 被操作节点断电或重启后，另外两台仍能支撑 `kubectl get nodes` 与 `curl http://192.168.0.108:32668/readyz` | 如果只动了一台，`kubectl` 已持续超时、`readyz` 长时间非 `200`，或未操作节点也一起异常，就先停手 |
| 三台计划停机 | 保守顺序 `192.168.0.7 -> 192.168.0.108 -> 192.168.0.128` | Portal 关机卡片已显示“可以继续关下一台”，且当前这台在虚拟化平台里已明确进入 `已关机` | 当前 VM 还在 `关机中`、控制台仍卡住、关机卡片显示“剩余栈收敛中”，或你无法确认它到底是“正在停”还是“没响应”，先不要连点 |
| 整套重新开机 | 保守顺序 `192.168.0.128 -> 192.168.0.108 -> 192.168.0.7` | 当前这台至少已经进入稳定启动阶段，例如可以 SSH、或控制台已到登录界面 | 当前 VM 还在 BIOS/内核早期启动、反复重启、或控制台明显报盘/文件系统错误，不要急着反复继续点 |
| 逐台重启回归 | 每次只动一台，等上一台完整回到集群 | 上一台 `ssh` 正常、`kubectl get nodes -o wide` 回到 `Ready`、`readyz` 为 `200` | 上一台还没回 `Ready`、`containerd/kubelet` 还没恢复、或 Longhorn / 业务入口还在明显收敛中，不要开始下一台 |

## 关机前先确认的事项

先看 live 页面：

- `http://192.168.0.108:30088`
- `http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview`
- `http://192.168.0.108:30086`
- `https://192.168.0.108:30443`

再确认节点与工作负载没有明显异常：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|Error|Pending|Unknown|Terminating' || true
curl -fsS http://192.168.0.108:32668/readyz
```

如果这次要尽量减小扰动，再额外确认“谁正拿着 VIP、谁是 etcd leader”：

```bash
for ip in 192.168.0.7 192.168.0.108 192.168.0.128; do
  echo "== $ip =="
  ssh root@"$ip" 'hostnamectl --static; ip -4 addr show dev enp3s0 | egrep "inet (192\\.168\\.0\\.(7|108|128)|192\\.168\\.0\\.110)"'
done
```

上面哪台机器回显了 `192.168.0.110/32`，哪台就是当前 `API VIP` 持有者。

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf -n kube-system exec etcd-node1 -- \
  etcdctl \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/peer.crt \
  --key=/etc/kubernetes/pki/etcd/peer.key \
  --endpoints=https://192.168.0.7:2379,https://192.168.0.108:2379,https://192.168.0.128:2379 \
  endpoint status -w table
```

`IS LEADER=true` 的那一行，对应当前 `etcd leader`。

## 单台维护的推荐顺序

目标：业务尽量不停。

规则只有一条：一次只动一台，等它完全恢复后再动下一台。

推荐做法：

1. 优先选择“既不是当前 `API VIP` 持有者，也不是当前 `etcd leader`”的节点
2. 如果只是改宿主机配置或做短时重启，优先动 `lab-cp-01 / 192.168.0.7`
3. `lab-cp-02 / 192.168.0.108` 放在中间，因为它承载了当前固定管理入口
4. 当前 `VIP` 持有者或 `etcd leader` 尽量最后动

如果你懒得现场判断，保守默认顺序可以先按下面执行：

1. `lab-cp-01 / 192.168.0.7`
2. `lab-cp-02 / 192.168.0.108`
3. `lab-cp-03 / 192.168.0.128`

但这只是兜底顺序，不如先确认 live 角色后再决定。

## 三台都要停机时的推荐顺序

目标：有计划地把整套环境停掉，而不是误以为还能保持高可用。

推荐顺序：

1. 先关当前非 `VIP` 持有者、非 `etcd leader` 的节点
2. 再关 `lab-cp-02 / 192.168.0.108`
3. 最后关当前 `VIP` 持有者 / `etcd leader`

如果不做 live 角色判断，当前保守兜底顺序是：

1. `lab-cp-01 / 192.168.0.7`
2. `lab-cp-02 / 192.168.0.108`
3. `lab-cp-03 / 192.168.0.128`

这套顺序的目标不是“停机过程中继续保持业务可用”，而是尽量把控制面与固定入口留到最后。

## 整套重新开机时的推荐顺序

目标：尽快恢复 `etcd quorum` 与 `K8s API`。

推荐做法：

1. 先开两台控制面节点，优先保证 `2/3` 活过来
2. 等 SSH 与 `kubelet/containerd` 基本恢复后，再开第三台
3. 如果不做额外判断，按关机反向顺序开机会更稳

当前保守兜底顺序：

1. `lab-cp-03 / 192.168.0.128`
2. `lab-cp-02 / 192.168.0.108`
3. `lab-cp-01 / 192.168.0.7`

比顺序本身更重要的是：

- 不要三台一起反复强制断电
- 不要在第一台还没进入稳定启动阶段前，又连续点第二台、第三台
- 每开一台都先等 SSH 或控制台状态稳定，再继续下一台

## 开机阶段的影响

和关机不同，开机时最容易误判的是“看到某一台亮了，就以为整套已经恢复”。

| 当前存活节点数 | 常见现象 | 运维判断 |
| --- | --- | --- |
| `1/3` | 单台 SSH 可能已恢复，但 `etcd` 还没有 quorum，`kubectl / Argo CD / Helm` 往往仍不可用 | 这是“单机起来了”，不是“集群恢复了” |
| `2/3` | `etcd` 通常恢复 quorum，`K8s API VIP` 大概率重新可用，控制面开始收敛 | 这是“控制面开始恢复”，但工作负载、PVC、入口不一定都已回稳 |
| `3/3` | 节点与控制面进入最终收敛，Longhorn、监控、GitOps、业务入口继续补齐 | 这才接近“整套恢复完成”，仍需要正式验收 |

额外注意：

- 如果 `lab-cp-02 / 192.168.0.108` 还没起来，`Portal / GitLab / Harbor / Argo CD` 这些固定管理入口仍会继续不可达，即使 `K8s API VIP` 已经恢复
- 如果只有一台节点恢复，不要急着判定 `kube-vip`、`Argo CD` 或业务系统坏了，很多现象只是因为 `etcd quorum` 还没回来
- 两台节点都起来后，控制面通常能恢复，但挂 `RWO PVC` 的服务可能还在等 Longhorn、旧 Pod 清理或卷重新挂载
- 三台都起来后，也不能只看某个页面能打开就收口，仍要跑一次统一冷启动验收

## 平台无关的电源操作建议

优先使用优雅关机，不要连续重复点“关机”。

推荐顺序：

1. 在 VM 里通过 `SSH` 或 `VNC` 执行 `systemctl poweroff`
2. 等虚拟化平台确认这台 VM 已经变成 `已关机`
3. 再处理下一台

只有来宾系统已经卡死、不响应 `SSH/VNC` 时，才使用宿主机的强制断电。

## 每次关机 / 开机后的验收

单台维护后至少做：

```bash
ping -c 2 192.168.0.7
ping -c 2 192.168.0.108
ping -c 2 192.168.0.128
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes -o wide
curl -fsS http://192.168.0.108:32668/readyz
curl -fsS http://192.168.0.108:30088/ >/dev/null
```

如果做的是整套停机、宿主机维护恢复或三节点顺序重启，必须再补一条正式验收：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-ha-lab-cold-start.sh
```

如果这轮要作为正式演练留档，再继续执行：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/verify-ha-lab-drill.sh simultaneous-reboot
```

## 不要误解的几点

- 这三台 VM 不是“主从架构”，而是 `3` 节点控制面
- `192.168.0.108` 是固定管理入口，不等于它永远是 `VIP` 持有者或 `etcd leader`
- 单台可维护，不代表可以同时关两台还指望 `kubectl`、`Argo CD`、`Helm` 正常
- 三台都关属于计划性整套停机，恢复后一定要跑冷启动验收，不能只看页面能打开就算结束
