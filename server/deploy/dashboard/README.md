# Kubernetes Dashboard 辅助模板

本目录只放 Kubernetes Dashboard 的辅助清单，不属于业务服务必需依赖。

## 文件说明

- `dashboard-admin-token.yaml`
  - 读取 `kubernetes-dashboard` 命名空间下的 `dashboard-admin` ServiceAccount
  - 适合在你已经创建好管理员 ServiceAccount 后快速取 token
- `kubernetes-dashboard-ingress.yaml`
  - 为 Dashboard 提供一个示例 Ingress
  - 默认域名是 `dashboard.example.local`
  - 默认 TLS secret 是 `dashboard-example-tls`

## 使用前要改的地方

- 把 `dashboard.example.local` 改成真实域名
- 把 `dashboard-example-tls` 改成真实证书 secret
- 如果接入 `cert-manager`，把注释里的 `replace-me` issuer 改成真实名称

## 说明

- 如果项目完全不用 Kubernetes Dashboard，可以直接移除整个目录。
- 如果只需要 Dashboard token，不必保留 Ingress 清单。
