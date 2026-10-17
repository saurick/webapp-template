# server/deploy 部署模板

模板保留 Compose 单机主路径与通用 Kubernetes 骨架。个人实验室的节点、平台应用、密文和运行记录已移出模板，派生项目按自己的环境维护部署事实。

| 目录 | 职责 | 使用说明 |
| --- | --- | --- |
| `compose/prod/` | 单机或单宿主机部署，默认 PostgreSQL 18 | [Compose](compose/prod/README.md) |
| `dev/`、`prod/` | Kubernetes 开发与生产 Kustomize 骨架 | [Kubernetes](../docs/k8s.md) |
| `dashboard/` | 可选的 Kubernetes Dashboard 辅助清单 | [Dashboard](dashboard/README.md) |
| `ci-runner/` | 隔离构建机上的项目专用 Docker Runner | [CI Runner](ci-runner/README.md) |

## 选择与初始化

1. 在仓库根运行 `bash scripts/init-project.sh`，按 [初始化指南](../../docs/project-init.md) 完成身份、品牌和端口配置。
2. 选择 Compose 或 Kubernetes 主路径，裁剪不需要的模板；两套都保留时写清各自目标环境。
3. 替换项目名、镜像、域名、namespace、数据库与认证占位符；真实凭据由本地覆盖配置或受控 secret 提供。
4. 运行 strict、镜像构建及所选部署形态的 preflight / 渲染检查。

## 构建与发布

镜像在开发机或 CI 构建并上传；低配目标机只加载镜像、迁移、启动和检查。默认镜像入口为 `make -C server build_server`，平台与代理说明见 [镜像构建](../../docs/image-build.md)。

Compose 正式迁移使用宿主机 `/usr/local/bin/atlas` 与 `flock /tmp/atlas-migrate.lock`，不把 Atlas 放进业务 Compose。发布后核对健康、就绪、受影响业务链和回滚点；通用约定见 [部署真源](../../docs/deployment-conventions.md)。

根 GitLab CI 执行模板和派生项目的初始化 / strict、镜像打包及加载验证；压测须显式启动。流水线与制品见 [GitLab CI](../../docs/gitlab-ci.md)，默认不自动部署。
