# 镜像构建与网络排障

初始化与 strict 完成后，在开发机或 CI 构建镜像。默认交付 `linux/amd64`，Node / Go 构建阶段使用构建器本机架构，Go 按最终目标交叉编译。镜像打包不会推送、部署或自动删除旧镜像。

## 构建入口

在仓库根执行：

```bash
make -C server build_server
```

构建器可访问基础镜像仓库与 npm / Go / Alpine 软件源时，该命令生成带时间和 Git 标识的版本标签，以及默认的 `dev` 标签。未提交源码在 Git 标识后带 `-local`，不能作为已发布提交的证据。

| 参数                                                             | 用途                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `IMAGE_REGISTRY`                                                 | 可选镜像仓库前缀；`DOCKER_HOST` 继续表示 Docker daemon 地址 |
| `IMAGE_NAME`                                                     | 在 make 命令行覆盖镜像仓库名，不含 tag；适合隔离演练与 CI   |
| `IMAGE_TAG` / `FIXED_TAG`                                        | 覆盖版本标签与本地固定标签                                  |
| `IMAGE_PLATFORM`                                                 | 最终平台，默认 `linux/amd64`；例如改为 `linux/arm64`        |
| `BUILDER`                                                        | 使用指定 Buildx builder，不改变全局选中的构建器             |
| `NODE_BUILDER_IMAGE` / `GO_BUILDER_IMAGE` / `RUNTIME_BASE_IMAGE` | 在受限网络中使用已审核的同版本基础镜像地址                  |
| `ALPINE_MIRROR` | 可选的公开 HTTPS Alpine 根地址，以 `/alpine` 结尾；保留运行基础镜像的主次版本与签名校验 |
| `BUILD_PROXY` | 可选的构建容器 HTTP 代理，传为 Docker 预定义 build args；与宿主机客户端代理分开 |

```bash
make -C server build_server \
  IMAGE_NAME=my-project-server \
  IMAGE_TAG=local-verification \
  FIXED_TAG=local-verification \
  IMAGE_PLATFORM=linux/amd64

docker image inspect my-project-server:local-verification \
  --format '{{.Id}} {{.Os}}/{{.Architecture}}'
docker run --rm --platform linux/amd64 \
  my-project-server:local-verification /app/server -h
```

构建成功只证明镜像可打包。首次运行仍需提供该项目的生产配置、JWT 与管理员配置、数据库和正式 migration；按 Compose 发布合同执行 preflight、migration、health/ready 和业务 smoke。

已有直接传入 `RUNTIMEPLATFORM`、`GO_TARGETOS` 或 `GO_TARGETARCH` 的调用，需统一迁移为 Docker 的 `--platform` 或 Make 的 `IMAGE_PLATFORM`，避免分别设置运行镜像和二进制架构。

## Docker Hub EOF 或镜像清单异常

先分层检查，避免将单个客户端失败直接归因为镜像版本不存在：

| 检查层            | 命令或现象                                                    | 判断                                                          |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| 引擎              | `docker context show`、`docker version`                       | 区分 daemon 不可用与仓库连接失败                              |
| 宿主网络          | `curl -I https://registry-1.docker.io/v2/`                    | 正常返回 401 表示已连接仓库；它不证明 daemon 使用相同网络路径 |
| OCI 清单          | `docker buildx imagetools inspect golang:1.26.9`              | 核对标签与目标架构；旧 `docker manifest` 命令失败时独立复核   |
| daemon / BuildKit | `docker pull alpine:3.21`、实际 Buildx 构建                   | 验证真正拉取；宿主代理环境不等于构建器代理                    |
| 加速配置          | `docker info` 中的 Registry Mirrors；清单被识别为 `text/html` | 加速端点可能返回网页，须核对响应和来源                        |

共享引擎正在运行其他项目时，可创建独立的 `docker-container` 构建器，显式使用已经验证可用的 HTTP 代理。这样可以隔离 daemon 的加速列表与代理路径，无需重启共享引擎或切换代理节点。

以下示例用于 Docker Desktop / OrbStack，代理地址从当前机器读取；代理必须允许容器通过 `host.docker.internal` 访问。Linux 环境需先按本机网络合同提供可达地址。

```bash
export BUILD_PROXY="http://host.docker.internal:${LOCAL_PROXY_PORT:?先设置本机代理端口}"
docker buildx create --name project-builder --driver docker-container \
  --driver-opt "env.HTTP_PROXY=${BUILD_PROXY}" \
  --driver-opt "env.HTTPS_PROXY=${BUILD_PROXY}" \
  --driver-opt env.NO_PROXY=localhost \
  --bootstrap

make -C server build_server BUILDER=project-builder
```

这只为该 builder 配置拉取基础镜像时的连接。Docker CLI 的 `proxies` 配置或构建代理参数作用于构建容器中的软件包下载，二者应分别验证；不要通过 Dockerfile `ENV` 把代理地址或凭据写进最终镜像。网络修复后再次运行实际构建，不能只以清单检查通过收口。

OrbStack 默认跟随系统代理，同时配置 SOCKS 与 HTTP 时优先 SOCKS。应分别验证 HTTP、SOCKS 与 DNS 路径，不能仅凭代理端口处于监听状态判断所有协议可用。参考 [OrbStack 网络说明](https://docs.orbstack.dev/docker/network#proxies)、[BuildKit 独立配置](https://docs.docker.com/build/buildkit/configure/) 与 [Docker 构建代理说明](https://docs.docker.com/engine/cli/proxy/)。

## 上下文与制品边界

根 `.dockerignore` 排除 Git 元数据、依赖和构建产物、部署文件、私有 `.env` / `config.local.yaml`、证书与日志。公开的 `web/.env.production` 继续参与 Vite 构建，必须只含可公开配置。运行镜像只复制服务端二进制、公开生产 `config.yaml` 与前端静态产物；真实生产覆盖配置在运行时注入。

构建回执应记录源码提交及本地变更、初始化选择、strict 结果、构建器、目标架构、基础镜像 digest、最终 image ID，以及实际执行的 smoke。旧镜像清理是独立操作，先核对在用与回滚版本，再选择明确可删除的标签；不要将共享 builder 或镜像清理并入打包主路径。

## Alpine 包源出现 TLS EOF

Docker Hub 拉取成功后，`RUN apk add` 仍可能因当前网络到 `dl-cdn.alpinelinux.org` 的路径失败而出现 TLS EOF。这一层与镜像仓库、BuildKit daemon 代理、宿主机客户端代理分别核对；容器可达的 `host.docker.internal` 地址不应直接替代宿主机的代理地址。

确认索引为正常签名的 APKINDEX 后，可从 [Alpine 官方镜像列表](https://mirrors.alpinelinux.org/) 选择同版本 HTTPS 源，显式构建：

```bash
make -C server build_server BUILDER=project-builder \
  ALPINE_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine
```

不传参数时继续使用基础镜像自带 repositories；参数不接受凭据、query 或空白，版本从运行基础镜像读取，包签名校验与 TLS 保持启用。依赖包安装位于 Git 版本元数据之前，更新提交不再单独触发这一网络层的重装。当前网络恢复默认源后可去掉参数；这不会切换代理节点或修改共享 daemon。代理构建参数的作用范围见 [Docker 官方说明](https://docs.docker.com/build/building/variables/#proxy-arguments)。

### 区分客户端、构建器与 RUN 的代理

`docker buildx` 的宿主机客户端、BuildKit daemon 和 Dockerfile RUN 是三个网络执行位置。macOS 的宿主客户端通常使用 loopback 代理，容器使用可达的宿主入口；只配置 daemon 不代表客户端取匿名 token 或 RUN 下载依赖也使用了相同路径。`BUILD_PROXY` 只传预定义 build args，不写入 Dockerfile ARG/ENV 或最终运行环境。

本机遇到混合 SOCKS / HTTP 环境时，保持全局设置不变，可在单次构建中只保留明确的 HTTP 路径：

```bash
HOST_BUILD_PROXY="http://127.0.0.1:${LOCAL_PROXY_PORT:?先核对本机 HTTP 代理端口}"
CONTAINER_BUILD_PROXY="http://host.docker.internal:${LOCAL_PROXY_PORT}"
env -u ALL_PROXY -u all_proxy \
  HTTP_PROXY="$HOST_BUILD_PROXY" HTTPS_PROXY="$HOST_BUILD_PROXY" \
  http_proxy="$HOST_BUILD_PROXY" https_proxy="$HOST_BUILD_PROXY" \
  make -C server build_server BUILDER=project-builder \
    BUILD_PROXY="$CONTAINER_BUILD_PROXY" \
    ALPINE_MIRROR=https://mirrors.tuna.tsinghua.edu.cn/alpine
```

代理需允许构建容器访问；Linux 或远端 builder 使用其实际可达地址。本次对比中，清除单次客户端的 SOCKS 环境后，默认协议与 HTTP/1 对照路径均完成冷构建；这不修改代理节点、全局环境或共享引擎。实际构建通过后应回读镜像环境与 `docker history`，确认代理值未进入运行制品。
