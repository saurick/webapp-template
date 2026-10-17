# 项目专用 CI Runner

在隔离 Linux/amd64 构建机注册项目级 Docker executor。Runner 锁定当前项目、只接受受保护分支，并匹配 `template-docker` 标签。管理进程需要构建机 Docker 权限；job 不挂载宿主机 socket、业务目录或部署凭据。

## 一次准备构建机

需要 Linux/amd64、Python 3.11+、systemd、已安装的 `gitlab-runner` 和可用 Docker。宿主 Docker 须能拉取根 CI 使用的官方镜像；脚本不安装 Docker、不调整共享 daemon 的代理或重启其他 Runner。

1. 将当前项目源码放到构建机。以 root 创建 `/etc/gitlab-runner-projects/`，权限 `0700`；把 [`host.json.example`](host.json.example) 复制为该目录内的 `host.json`，权限 `0600`。
2. 配置真实 `gitlab_url` 和 `api_token_file`。API token 文件也须 root 所有、权限 `0600`，由密钥管理工具或安全编辑器写入，避免经命令参数、历史和 CI 变量传递。
3. API 身份须是目标项目 Maintainer，具备 `api`、`create_runner`、`manage_runner` scopes，以便配置分支保护、创建与核对 Runner。优先使用短期项目 access token；同一组的新项目可使用受控的 group access token，统一轮换。管理凭据只在初始化进程读取，不写入 job、服务环境或生成的 Runner 配置。参考 [GitLab 自动注册说明](https://docs.gitlab.com/tutorials/automate_runner_creation/)。
4. 按实际网络填写 `environment` 和 `extra_hosts`；无须代理时保留空对象和空列表。GitLab 管理 API 使用验证证书的 HTTPS 直连，构建机 DNS / hosts 须能解析到可达入口；`extra_hosts` 只作用于 job / service 容器。

| 配置 | 用途 |
| --- | --- |
| `HTTP_PROXY` / `HTTPS_PROXY` 及小写变体 | Runner 管理进程和 job / DinD 网络；宿主 Docker daemon 仍使用其既有配置 |
| `NO_PROXY` / `no_proxy` | 保留输入项，并自动补齐 GitLab 主机、`docker`、loopback；大小写统一 |
| `ALPINE_MIRROR` | 可选公开 HTTPS `/alpine` 镜像地址，仅传入 job |
| `GOPROXY` | 可选 Go module 下载代理，仅传入 job |
| `extra_hosts` | 可选 `host:IP` 列表，用于容器内的 GitLab 或其他依赖解析 |

## 每个新项目执行一条命令

在构建机的项目根目录执行，项目必须已在 GitLab 创建：

```bash
sudo python3 scripts/ci/setup-runner.py \
  --config /etc/gitlab-runner-projects/host.json \
  --project your-group/your-project
```

空仓库尚无默认分支时加 `--branch master`（或项目计划使用的默认分支）；已有默认分支时必须匹配。脚本通过正式 GitLab API 创建项目专用 Runner，用返回的认证 token 生成 [`config.toml.example`](config.toml.example) 对应配置，再启动独立管理进程完成注册。

| 自动完成 | 状态与边界 |
| --- | --- |
| Runner 创建 / 注册 | 项目级、locked、protected、禁止 untagged，标签 `template-docker`；先 pause，配置完成后启用并等待 online |
| 默认分支保护 | 缺失时设置 Maintainer push / merge / unprotect 且禁止 force push；已有保护保留，已有 force push 时阻断 |
| 私有配置与服务 | `/etc/gitlab-runner-projects/<实例摘要>-<项目 ID>/`、`/var/lib/gitlab-runner-projects/<同一标识>/` 与 `gitlab-runner-project-<同一标识>.service`；不写共享 `config.toml` |
| CI 环境 | 网络参数进入本项目 Runner，自动补齐 DinD NO_PROXY，保留 TLS、独立 job 网络、资源限制与受限 rootless service |
| 重复与恢复 | 已有本脚本状态时复用 Runner；无差异不 restart，主机安装中断后同命令恢复；其他配置 / Runner 或归属漂移时阻断 |
| 状态回读 | 输出 project ID、Runner ID、service、online / protected 与是否变更，不输出 token 或网络值 |

脚本通过进程级 `flock` 阻止同一项目并发初始化。配置更新会先 pause；若存在活动 job，保留现场并阻断，job 结束后重跑。不要删除状态文件来“重新注册”。API 创建结果不明或 token 保存前中断时，脚本拒绝重复创建同名 Runner；管理员核对其归属及 paused 状态后，只删除该未完成 Runner，再重跑。

## 检查、停用与恢复

```bash
# 检查配置、Runner online、权限、主分支保护和服务
sudo python3 scripts/ci/setup-runner.py --config /etc/gitlab-runner-projects/host.json \
  --project your-group/your-project --check

# 暂停接单，确认空闲后停用该项目服务；保留配置用于恢复
sudo python3 scripts/ci/setup-runner.py --config /etc/gitlab-runner-projects/host.json \
  --project your-group/your-project --pause
```

`--pause` 遇活动 job 会保持 Runner paused，结束后重跑才能停服务。恢复执行最初的初始化命令即可；API token 过期时先安全轮换 token 文件。脚本不删除项目、Runner、镜像、缓存或制品。

Ubuntu 24.04+ 的全局 userns 限制启用时，脚本自动安装并加载非标准路径 `/usr/local/bin/rootlesskit` 的 [`rootlesskit.apparmor`](rootlesskit.apparmor)；若已有同路径不同规则则阻断，不覆盖。只加载该规则，无需重启 AppArmor 或修改全局 sysctl。规则来自 [Rootless Containers 官方说明](https://rootlesscontaine.rs/getting-started/common/apparmor/)；保留 `kernel.apparmor_restrict_unprivileged_userns=1`，其他普通 job 仍使用 Docker 默认保护。手工排障入口：

```bash
sudo install -m 0644 server/deploy/ci-runner/rootlesskit.apparmor /etc/apparmor.d/template-rootlesskit
sudo apparmor_parser -r /etc/apparmor.d/template-rootlesskit
```

示例管理进程全局并发为 1；job 上限 3 GiB / 4 CPU，DinD service 上限 4 GiB / 4 CPU。构建机需为其他任务另留资源。job 使用普通容器；只有官方 `docker:*-dind-rootless` service 可获得 privileged 模式，服务与 job 通过 TLS 和每 job 独立网络通信。该范围沿用 [GitLab 官方的 restricted rootless DinD 方案](https://docs.gitlab.com/runner/executors/docker/#use-rootless-docker-in-docker-with-restricted-privileged-mode)。

构建机的 Docker 拉取代理、管理进程代理、job / DinD 代理需分别检查。私有地址、NO_PROXY、证书及 Runner token 只放运行配置或受控变量；不写入模板。job 中的 Docker 主机名 `docker` 必须加入 NO_PROXY。必要时设置公开 HTTPS `ALPINE_MIRROR`，参数合同见 [`docs/image-build.md`](../../../docs/image-build.md)。

升级 Go 时同步根 CI 的 `CI_GO_IMAGE`；配置中的默认 job image 只是无显式 image 时的兜底，也应同步。升级 Docker CLI / DinD 时保持两个版本一致，仍限制为官方 rootless service。停用时先 pause 此项目 Runner，等待其 job 结束，再只停止对应管理进程；保留配置、token 和当前制品供恢复，不修改其他 Runner。

流水线、派生 fixture、制品与验收入口见 [`docs/gitlab-ci.md`](../../../docs/gitlab-ci.md)。
