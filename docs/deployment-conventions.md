# 部署真源约定

模板默认提供单机 Compose 与通用 Kubernetes 骨架。派生项目选择符合实际环境的主路径，并把配置、迁移、发布和回滚事实维护在自己的仓库中。

## 部署路径

| 路径 | 适用范围 | 正式入口 |
| --- | --- | --- |
| `server/deploy/compose/prod` | 单项目、单宿主机、SSH 发布 | [Compose 说明](../server/deploy/compose/prod/README.md) |
| `server/deploy/dev`、`server/deploy/prod` | 已有 Kubernetes 集群，按环境维护 Kustomize overlay | [Kubernetes 说明](../server/docs/k8s.md) |
| `server/deploy/dashboard` | 可选的 Kubernetes Dashboard 辅助模板 | [Dashboard 说明](../server/deploy/dashboard/README.md) |

个人实验室的节点地址、Helm release、Argo 应用、运行记录和 SealedSecret 不属于通用模板。原 `server/deploy/lab-ha` 已从模板移除；不会因此卸载、修改或重新部署任何现有环境。需要高可用平台的项目，应在派生仓库按自己的资源、凭据和运维责任建立部署合同。

## 单机主路径

1. 在开发机或 CI 运行 [strict 与镜像构建](image-build.md)，记录 commit、image ID 和制品校验值。
2. 在目标机加载制品，按 Compose 说明完成生产 preflight。
3. 使用宿主机 `/usr/local/bin/atlas` 与 `flock /tmp/atlas-migrate.lock` 执行正式迁移，不把 Atlas 作为业务 Compose 服务。
4. 启动后核对 `/healthz`、`/readyz` 和受影响的真实业务链；保留配置、迁移、镜像和回滚点的对应关系。

低配目标机只加载制品、迁移、启动和检查。镜像入口为 `make -C server build_server`，默认 `linux/amd64`；镜像仓库使用 `IMAGE_REGISTRY`，`DOCKER_HOST` 保留 daemon 连接语义。

## Kubernetes 与单一真源

通用 `dev` / `prod` 骨架使用 Kustomize。派生项目引入第三方 chart、环境变体或 GitOps 时，再选择 Helm / Argo 等合适工具；同一资源始终只保留一个长期安装入口。

应急 patch 必须回收到正式配置，再核对渲染、迁移、运行状态与回滚。`helm lint`、`helm template`、`kubectl kustomize` 证明配置可渲染，不能代替目标环境部署验证。

## 凭据与 CI

默认配置只包含可识别的占位符。真实密码、token、证书与密文由派生项目的本地覆盖配置或受控 secret 管理；已有环境加密的 Secret 不能作为新项目的默认配置继承。

根 `.gitlab-ci.yml` 默认执行模板 strict / hook 回归、离线派生初始化与 strict，以及模板 / 派生镜像打包、导出加载回验。Runner 与制品合同见 [GitLab CI](gitlab-ci.md)。压测必须手动指定目标并启动，结果写入 `output/loadtest/`。模板 CI 不访问个人业务节点、不读取宿主机 kubeconfig，也不自动发布或部署。

## 清理与回滚

发布前核对 commit/image、migration、config、health/ready、业务 smoke 和回滚点。保留当前及约定回滚版本后，再清理明确可重建的旧制品；禁止无条件 `docker image prune -a`、volume prune 或删除数据库、上传、证书及环境配置。
