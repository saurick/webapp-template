# GitLab CI：初始化、strict 与镜像交付

默认流水线在隔离 Linux/amd64 Docker Runner 中验证模板和离线派生项目，再交付可加载的镜像归档。Runner 注册、运行地址和凭据属于环境配置；通用流水线随新项目继承。

## 任务与验收

| 任务                 | 输入与执行                                                                                         | 成功证据                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `validate_template`  | 当前 commit；bootstrap、strict、Git hook 回归                                                      | 工具链、密钥与可达漏洞扫描、脚本 / web / Go 测试及构建全部成功                   |
| `initialize_project` | `git archive HEAD`；真实基础配置工具；离线部署配置；`init --project --strict`、bootstrap 与 strict | `derived.bundle` 和绑定 source SHA / derived SHA / pipeline ID 的 `derived.json` |
| `package_template`   | 当前源码与正式 `server/Dockerfile` / Make 构建入口                                                 | 模板 Linux/amd64 镜像、二进制和静态资源检查、save → load ID 一致                 |
| `package_derived`    | 同一流水线通过初始化与 strict 的 bundle                                                            | 派生 Linux/amd64 镜像与同样的归档加载检查，拒绝混用其他 SHA / pipeline 的输入    |

默认任务顺序为 validate → initialize → package。任一必要任务失败，流水线不能成功；两个镜像任务受专用 Runner 并发限制。手动压测继续由 `PIPELINE_MODE=loadtest` 提供，必须填写已授权目标；不纳入默认初始化 / 打包验收。

模板源仓库的派生验证用 `ci-client` 合成配置补齐身份、品牌、端口与离线部署占位，再运行正式检查；已经初始化的新项目保留现有身份、品牌和端口，不重新改名。合成值明确标为 `ci-fixture-only`，不连接数据库或真实目标，也不作为项目初始化时的真实凭据。派生镜像元数据含 `fixture_only=true`，只证明初始化后的工程与打包链，不能直接部署。

## Runner 与工具链

从零创建项目时使用 [统一入口](project-bootstrap.md)，从 Mac 自动准备构建机、核对 namespace 授权并完成创建、工程初始化、专属 Runner 接入和首轮 CI 回读；以下独立 Runner 流程用于已有仓库。

1. 按 [`ci-runner/README.md`](../server/deploy/ci-runner/README.md) 一次准备构建机私有配置；在构建机执行 `sudo python3 scripts/ci/setup-runner.py --config /etc/gitlab-runner-projects/host.json --project your-group/your-project`，自动配置主分支保护、项目专用 Runner、CI 网络环境与独立服务，等待 online。重复执行复用已有 Runner；`--check` 回读，`--pause` 安全停用。主分支须受保护；其他分支或 MR 按项目的信任边界配置独立 Runner。
2. 普通 job 不挂载宿主机 Docker socket。镜像 job 使用同版本 Docker CLI / rootless DinD，启用 TLS 和独立网络；Runner 仅允许官方 rootless DinD service 的 privileged 模式。
3. `CI_GO_IMAGE` 与 `server/go.mod` 必须一致，`check-toolchain` 自动阻断漂移。Node 与 pnpm 分别读取 `.n-node-version` / `web/package.json`。job 从发行版 HTTPS 源安装 xz / ShellCheck / ripgrep；Node 下载使用 HTTP/1.1 兼容部分代理的 HTTP/2 stream reset，并核对官方 SHASUMS，QA 工具固定版本。TLS 验证与签名 / 校验值不变。
4. 工具、pnpm 与 Go 缓存写入忽略的 `.cache/`，不进入源码或镜像上下文。`validate_template` 是缓存的唯一上传者，初始化任务只读取，避免重复压缩和上传。缓存仅减少下载与编译，不跳过 strict、锁文件或密钥检查。

Runner 管理进程、宿主 Docker、job、DinD 与 Dockerfile RUN 的代理是不同层。环境需要代理时，仅在 Runner 的私有运行配置或受控 CI 变量中设置 `HTTP_PROXY` / `HTTPS_PROXY` 及大小写变体；NO_PROXY 必须包含 GitLab 的真实可达入口、`docker` 和本地地址。不要把私有节点写入模板、关闭 TLS，或修改共享引擎解决单项目问题。Alpine 网络受限时，使用 [`image-build.md`](image-build.md) 约定的公开 HTTPS `ALPINE_MIRROR`。

## 制品与回读

镜像构建复用 [`image-build.md`](image-build.md) 的有界恢复：只重试 BuildKit 明确报告的 Docker Hub metadata / FROM 网络瞬断，最多 3 次，等待 3 / 10 秒。真实构建、认证权限、校验与未知错误立即阻断；不对整个 job 配置无差别重试。每次尝试及最终状态写入 `output/ci/images/build-logs/`，失败也上传日志；其余制品只在相应步骤完成后产生。

成功的镜像 job 在 `output/ci/images/` 生成 `.tar.gz`、`.sha256` 和各自的 JSON 元数据，默认保留 7 天。元数据绑定流水线 SHA、实际源码 SHA、CI 引擎镜像 ID、归档配置的 `config_digest`、未压缩层的 `rootfs_diff_ids`、平台和归档校验值，以及 load / 二进制 / 静态文件 / 代理不入镜像的结果。派生源码 bundle 也仅保留 7 天；该保留时间还受实例“保留最新成功流水线制品”策略影响。

下载某一个成功镜像任务的制品后，在对应目录执行：

```bash
sha256sum --check ./*.sha256
gzip -dc ./template-*-linux-amd64.tar.gz | docker image load
```

CI 在同一引擎中要求 save / load 前后 `image_id` 相同。跨引擎读取时，containerd 存储的 ID 可能是 OCI index / manifest digest，classic 存储的 ID 则是 config digest，不能仅凭这两个 ID 不同就判断制品损坏。先核对归档 SHA-256；classic 引擎的加载 ID 应等于 `config_digest`，两种引擎的 `.RootFS.Layers` 均应等于 `rootfs_diff_ids`，并核对平台与 `GIT_SHA`。真实发布继续按配置、迁移、preflight、health/ready 和业务 smoke 合同执行；默认流水线不推送 Registry 或部署。

## 故障与恢复

| 现象                      | 检查与恢复                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pending / stuck           | 项目 Runner 是否 online、locked 到本项目，protected 与分支匹配，tag 是否一致；不通过取消分支保护让 job 运行                                                             |
| 工具下载失败              | 看具体 Node / npm / Go / Debian 软件源和代理层；使用精确版本重试，保留失败证据，不设置 skip                                                                             |
| DinD 不可达               | 检查官方 rootless service allowlist、TLS 证书共享目录、`docker` alias、NO_PROXY 和 service 日志；Ubuntu 的 userns 拒绝按 Runner 专题加载 RootlessKit 专用 AppArmor 规则 |
| Docker Hub / Alpine EOF   | 按 image-build 分层定位；不把宿主 curl 成功当作 daemon / RUN 成功                                                                                                       |
| 初始化失败                | 从“必须处理项”的路径定位真实残留，维护 fixture 的明确配置输入；不放宽正式 init / secret 检查                                                                            |
| 输入 SHA 或镜像回读不一致 | 保留任务制品和日志，修正输入或打包链，再绑定新 commit 跑完整必要阶段                                                                                                    |

验收记录应链接 exact commit 的成功 GitLab pipeline 和四个必要 job，并保留镜像校验值。Runner online、本地 strict 或单个 job 成功均不能替代流水线终态。
