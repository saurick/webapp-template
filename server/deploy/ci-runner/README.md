# 项目专用 CI Runner

在隔离 Linux/amd64 构建机注册项目级 Docker executor。Runner 锁定当前项目、只接受受保护分支，并匹配 `template-docker` 标签。管理进程需要构建机 Docker 权限；job 不挂载宿主机 socket、业务目录或部署凭据。

1. 在 GitLab 项目的 **Settings → CI/CD → Runners** 创建 project runner：设置标签 `template-docker`，关闭 untagged，开启 protected，保持 locked。
2. 在隔离构建机使用受支持的 GitLab Runner 注册，认证 token 仅在构建机的 root-only 文件或交互流程中提供。不要提交 token、registration.env 或生成后的 config.toml。
3. 按 [`config.toml.example`](config.toml.example) 配置独立管理进程。填写真实 GitLab URL 和注册产生的 token，权限设为 `0600`；保留已存在的 Runner 配置和服务。
4. 通过原有 systemd / 容器服务管理此配置。核对 online、project ID、locked、protected、tag、executor 和资源限制，再启动根 CI。

Ubuntu 24.04+ 若出现 RootlessKit `operation not permitted`，先核对内核 AppArmor 的 `userns_create` 拒绝记录。为非标准路径 `/usr/local/bin/rootlesskit` 安装 [`rootlesskit.apparmor`](rootlesskit.apparmor)，仅加载该规则，无需重启 AppArmor 或修改全局 sysctl。规则来自 [Rootless Containers 官方说明](https://rootlesscontaine.rs/getting-started/common/apparmor/)；保留 `kernel.apparmor_restrict_unprivileged_userns=1`，其他普通 job 仍使用 Docker 默认保护。

```bash
sudo install -m 0644 server/deploy/ci-runner/rootlesskit.apparmor /etc/apparmor.d/template-rootlesskit
sudo apparmor_parser -r /etc/apparmor.d/template-rootlesskit
```

示例管理进程全局并发为 1；job 上限 3 GiB / 4 CPU，DinD service 上限 4 GiB / 4 CPU。构建机需为其他任务另留资源。job 使用普通容器；只有官方 `docker:*-dind-rootless` service 可获得 privileged 模式，服务与 job 通过 TLS 和每 job 独立网络通信。该范围沿用 [GitLab 官方的 restricted rootless DinD 方案](https://docs.gitlab.com/runner/executors/docker/#use-rootless-docker-in-docker-with-restricted-privileged-mode)。

构建机的 Docker 拉取代理、管理进程代理、job / DinD 代理需分别检查。私有地址、NO_PROXY、证书及 Runner token 只放运行配置或受控变量；不写入模板。job 中的 Docker 主机名 `docker` 必须加入 NO_PROXY。必要时设置公开 HTTPS `ALPINE_MIRROR`，参数合同见 [`docs/image-build.md`](../../../docs/image-build.md)。

升级 Go 时同步根 CI 的 `CI_GO_IMAGE`；配置中的默认 job image 只是无显式 image 时的兜底，也应同步。升级 Docker CLI / DinD 时保持两个版本一致，仍限制为官方 rootless service。停用时先 pause 此项目 Runner，等待其 job 结束，再只停止对应管理进程；保留配置、token 和当前制品供恢复，不修改其他 Runner。

流水线、派生 fixture、制品与验收入口见 [`docs/gitlab-ci.md`](../../../docs/gitlab-ci.md)。
