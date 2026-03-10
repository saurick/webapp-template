# Kubernetes 部署模板说明

当前仓库已内置两套 Kubernetes 清单模板：

- `/Users/simon/projects/webapp-template/server/deploy/dev`
- `/Users/simon/projects/webapp-template/server/deploy/prod`

它们的目标不是直接适配某个固定客户环境，而是提供一套最小、完整、可初始化的部署骨架。

## 每个环境目录包含什么

- `namespace.yaml`：命名空间模板
- `kustomization.yaml`：统一 apply 入口
- `configmap.yaml`：服务配置占位
- `secret.yaml`：镜像仓库拉取凭据占位
- `service.yaml`：集群内访问入口
- `deployment.yaml`：容器镜像、资源限制、探针与挂载

## 推荐使用方式

先把占位符替换成当前项目真实值，再通过 `kustomize` 入口应用：

```bash
# 开发环境
kubectl apply -k /Users/simon/projects/webapp-template/server/deploy/dev

# 生产环境
kubectl apply -k /Users/simon/projects/webapp-template/server/deploy/prod
```

## 初始化后必须替换的占位符

- `your-project`
- `your-project-server`
- `registry.example.com`
- `replace-me`
- `otel-collector.observability.svc.cluster.local`

如果派生项目不需要自带 tracing，也可以在初始化阶段直接删除 `trace` 配置，或改成当前项目的观测地址。

## 当前清单的默认约定

- 服务名默认是 `your-project-server`
- 开发环境命名空间默认是 `your-project-dev`
- 生产环境命名空间默认是 `your-project-prod`
- 容器启动命令默认读取 `/config/config.yaml`
- 服务端口默认：
  - HTTP `8000`
  - gRPC `9000`
- 探针默认：
  - `startupProbe` -> `/readyz`
  - `readinessProbe` -> `/readyz`
  - `livenessProbe` -> `/healthz`
- Service 默认是 `ClusterIP`

## 配置和密钥建议

- `configmap.yaml` 里当前保留的是模板级最小配置骨架；初始化后要替换 DSN、JWT 密钥、管理员密码和 traceName。
- 生产环境不要长期把敏感配置直接留在 `ConfigMap`，应尽快迁移到 `Secret`、`ExternalSecret` 或你的密钥管理方案。
- `secret.yaml` 当前只放了镜像仓库凭据占位；请替换成真实 `.dockerconfigjson`。

## 额外说明

- 这套模板默认不包含 Ingress，因为域名、证书、网关和入口策略在不同项目之间差异很大。
- `dashboard/` 下的清单是可选辅助项，不属于业务服务部署主链路。
- 如果当前项目最终只走 Docker Compose，可以删除整个 `server/deploy/dev`、`server/deploy/prod` 和 `server/deploy/dashboard`。
