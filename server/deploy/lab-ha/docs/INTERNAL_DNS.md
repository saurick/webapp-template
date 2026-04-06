# WebApp 内部域名落地说明

## 当前口径

- `webapp-trial.lab.home.arpa` 对应 `Prod-Trial Active`
- `webapp-trial-preview.lab.home.arpa` 对应 `Prod-Trial Preview`
- 这两个域名现在只承担“浏览器更好记”的作用，不再参与集群内路由选择
- 业务入口已经改成 `Cilium Gateway hostNetwork` 直出，因此内部域名不需要额外 Helm overlay

## 推荐解析方式

给两个域名都配置三条 A 记录：

- `192.168.0.7`
- `192.168.0.108`
- `192.168.0.128`

访问端口固定为：

- `webapp-trial.lab.home.arpa:30089`
- `webapp-trial-preview.lab.home.arpa:30091`

这套方式的目标不是“伪装成 80/443”，而是在当前路由、VPN 和实验室网络现实下，先把可用、可维护的高可用入口固定下来。

## 同网段与跨网段

- 如果访问端和集群在同一局域网，内网 DNS 直接返回上面三条 A 记录即可
- 如果访问端通过 `Tailscale` 或其他 routed 网络进入，也继续使用同一组 A 记录和 `30089 / 30091`
- 不再把业务内部域名建立在旧 `MetalLB` VIP 或 `Ingress Host` 规则之上

## 验证方式

直接验证域名：

```bash
curl --noproxy '*' http://webapp-trial.lab.home.arpa:30089/readyz
curl --noproxy '*' http://webapp-trial-preview.lab.home.arpa:30091/readyz
```

如果当前客户端没有内网 DNS，可临时用 `hosts` 做单机验证：

```text
192.168.0.108 webapp-trial.lab.home.arpa
192.168.0.108 webapp-trial-preview.lab.home.arpa
```

再执行：

```bash
curl --noproxy '*' http://webapp-trial.lab.home.arpa:30089/readyz
curl --noproxy '*' http://webapp-trial-preview.lab.home.arpa:30091/readyz
```

如果要验证三台节点的正式端口，而不是 DNS：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/check-webapp-prod-trial-bluegreen.sh \
  192.168.0.7 192.168.0.108 192.168.0.128
```

## 不再需要的旧做法

- 不再需要 `values-prod-trial-internal.yaml`
- 不再需要 `argocd-webapp-prod-trial-app-internal.yaml`
- 不再需要 `Host` 头 + `32668` 的内部域名验证方式
- 不再需要为内部域名单独维护 `Ingress` host patch

## 相关文件

- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/charts/webapp-template/values-prod-trial.yaml`
- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/PROD_TRIAL.md`
- `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/TAILSCALE.md`
