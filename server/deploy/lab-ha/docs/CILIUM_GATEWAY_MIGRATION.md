# Cilium Gateway API 切换说明

## 当前状态

- `ingress-nginx` 已从 `lab-ha` 的正式入口链路下线
- `WebApp Lab` 正式端口：`32668`
- `WebApp Prod-Trial Active` 正式端口：`30089`
- `WebApp Prod-Trial Preview` 正式端口：`30091`
- 三条入口都由 `Cilium Gateway hostNetwork` 直接暴露

## 已完成改动

- `Gateway API CRD` 固定到仓库真源：
  - `/Users/simon/projects/webapp-template/server/deploy/lab-ha/manifests/gateway-api-v1.4.1-standard-install.yaml`
- `Cilium` Helm 真源升级到 `1.19.2`
- `webapp-template` chart 只保留 `Gateway + HTTPRoute + CiliumNetworkPolicy`
- `prod-trial` 蓝绿发布检查改为直接打 `30089 / 30091`
- `Portal`、`blackbox-exporter`、`Grafana Service Governance` 和告警都已切到正式 Gateway 口径

## 当前验收口径

- `kubectl get gateway -A` 与 `kubectl get httproute -A` 能看到 `Accepted / Programmed`
- 三台节点的 `32668 / 30089 / 30091` 对应 `/readyz` 返回 `200`
- `Hubble` 能看到 `world -> ingress -> backend` 流量
- `Grafana Service Governance` 与 `PrometheusRule` 不再依赖 `nginx_ingress_controller_*`

## 剩余清理方向

- 若仓库里仍存在历史 `Ingress` 清单、旧 Kustomize overlay 或 runbook 历史描述，只作为“历史记录”保留，不再代表 live 真源
- 后续若新增业务入口，默认直接走 `Gateway API`，不要再恢复 `Ingress NGINX` 路径
