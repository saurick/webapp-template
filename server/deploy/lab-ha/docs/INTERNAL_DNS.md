# WebApp 内部域名落地说明

## 目标

- `webapp-prod-trial` 先走内部域名，不急着暴露公网
- 管理面和业务入口统一改成“域名访问”，逐步替换 `nip.io + IP:Port`
- 保持现有 `prod-trial` 配置可用，内部域名改动通过独立 values overlay 落地

## 什么时候用内部域名

适合当前这阶段：

- 先做生产试验
- 先验证浏览器访问、登录态、回调地址、Ingress Host
- 暂时不开放外部真实用户访问

不建议现在就把管理面直接做公网解析；`Argo CD`、`Grafana`、`Harbor` 这类入口优先保留内网访问。

## 域名建议

默认命名：

- `webapp-trial.lab.home.arpa`
- `argocd.lab.home.arpa`
- `grafana.lab.home.arpa`
- `harbor.lab.home.arpa`

这套命名直接使用保留域名 `home.arpa`，适合纯内网访问，不依赖 Cloudflare 或公网域名，也能避免 `.local` 与 mDNS 冲突。

## Cloudflare 是否需要

内部访问域名默认不需要 Cloudflare 这种外部公共解析。

更合理的做法是：

1. 同二层广播域场景：内网 DNS 直接把 `*.lab.home.arpa` 解析到 `192.168.0.120`
2. 小范围临时验证时，先在本机 `hosts` 写死到 `192.168.0.120`

这里的 `192.168.0.120` 是当前 `ingress-nginx-controller` 的对内入口 VIP，不是任意一台 VM 的固定节点 IP。

## L2 边界说明

`MetalLB` 当前使用的是 L2 模式，所以 `192.168.0.120` 更准确地说是“局域网入口 VIP”。

- 如果访问端和三台集群节点处于同一二层广播域，内部 DNS / `hosts` 指向 `192.168.0.120` 是合理的
- 如果访问端是通过 VPN、subnet router、`utun` 之类的路由方式去访问 `192.168.0.0/24`，则可能能访问 `192.168.0.7 / 108 / 128` 这些真实节点 IP，但访问不到 `192.168.0.120` 这个 L2 VIP

这不是 `webapp` 本身故障，而是入口网络模型不同导致的边界条件。当前生产试验如果主要从“跨网段 / VPN 客户端”访问，优先继续使用 `node2/node3 + NodePort` 做验证；等后续网络入口收口完成，再把内部域名完整切到标准 `80/443`。

## 当前阶段最终口径

对当前这套实验室环境，推荐把下面这套方式视为“内部生产试验正式入口”：

1. 业务域名固定为 `webapp-trial.lab.home.arpa`
2. 内网 DNS 为同一个域名配置多条 A 记录：
   - `192.168.0.7`
   - `192.168.0.108`
   - `192.168.0.128`
3. 业务访问暂时统一使用 `http://webapp-trial.lab.home.arpa:32668`
4. 若后续补内部 TLS，再对应切到 `https://webapp-trial.lab.home.arpa:30943`
5. `ingress-nginx-controller` 保持 `externalTrafficPolicy=Cluster`，确保 NodePort 不依赖“当前访问的那个节点本地必须正好有 ingress pod”

这套口径的目标不是追求“看起来像标准 80/443”，而是在你当前 VPN / 路由访问现实下，先把真实可用的高可用链路固定下来。

## 清单位置

- 当前运行中的基础试验 values：`charts/webapp-template/values-prod-trial.yaml`
- 内部域名 overlay：`charts/webapp-template/values-prod-trial-internal.yaml`
- Argo CD 切换清单：`manifests/argocd-webapp-prod-trial-app-internal.yaml`

内部域名 overlay 会在保留当前 `nip.io` 试验 Host 的前提下，额外增加一个内部域名 Host，避免切换时直接打断现有验证链路。

## 切换步骤

1. 修改 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial-internal.yaml`
2. 当前默认内部域名是 `webapp-trial.lab.home.arpa`；如果你后面想换成别的内部命名，再改这里
3. 预览输出：

```bash
helm template webapp-template-prod-trial /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template \
  -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial.yaml \
  -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial-internal.yaml | rg -n 'host:|image:'
```

4. 如果访问端与集群在同一二层广播域，只做本机临时验证时，可先加 `hosts`：

```text
192.168.0.120 webapp-trial.lab.home.arpa
```

5. 如果是 Argo CD 接管模式，再把现有应用切到 internal overlay：

```bash
kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf apply \
  -f /Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml
```

6. 验证：

同二层广播域场景：

```bash
curl --noproxy '*' --resolve 'webapp-trial.lab.home.arpa:80:192.168.0.120' \
  http://webapp-trial.lab.home.arpa/readyz
```

跨 VPN / 子网路由场景的保守验证方式：

```bash
curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' \
  http://192.168.0.7:32668/readyz

curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' \
  http://192.168.0.108:32668/readyz

curl --noproxy '*' -H 'Host: webapp-trial.lab.home.arpa' \
  http://192.168.0.128:32668/readyz
```

也可以直接使用脚本：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-internal.sh
```

## Argo CD 使用方式

如果后续改成由 Argo CD 接管内部域名版本，不要新建第二个指向同一命名空间的 Application。

更稳的方式是：

1. 继续沿用现有 `webapp-template-prod-trial`
2. 直接 apply `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/argocd-webapp-prod-trial-app-internal.yaml`

这样不会出现两个 Argo 应用同时管理同一批对象。

## 当前边界

- 当前仍共享 `webapp_template` 数据库，只适合生产试验
- 当前内部域名方案默认还是 HTTP；正式长期使用时再补内部 TLS
- 当前内部域名 values overlay 默认同时保留现有 `webapp-trial.192.168.0.108.nip.io`，等内部域名验证稳定后，再决定是否移除旧 Host
- 当前 `192.168.0.120` 这条入口依赖 `MetalLB L2`，是否能从客户端直达，取决于客户端是否真正位于可学习该 VIP 的二层网络
- 当前阶段正式推荐入口已经收口为 `webapp-trial.lab.home.arpa + NodePort 32668/30943 + 多节点 A 记录`，不是单一节点 IP
- 当前阶段优先验证“域名访问 + 恢复 + 滚动更新”，不是公网暴露
