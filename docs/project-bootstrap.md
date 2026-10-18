# 一键创建项目并验收首轮 CI

从 Mac 的干净模板仓库执行一条命令，自动检查 namespace 授权、准备构建机、传送绑定 HEAD 的源码，再创建私有 GitLab 项目、初始化、接入专属 Runner 并验收首轮 CI。已有仓库继续用 [Runner 接入](../server/deploy/ci-runner/README.md)。

## Mac 入口

```bash
python3 scripts/create-project-remote.py \
  --project your-group/my-project --name '我的项目'
```

每个项目只需提供完整路径和显示名称。脚本自动分配构建机源码目录，成功后输出项目、pipeline 链接和本地 JSON 回执；默认回执按 GitLab / project 摘要分别保存在 `output/project-bootstrap/remote/`，也可用 `--receipt` 指定。等待 CI 默认 3600 秒，`--timeout` 可设置 60..7200 秒。

首次只需准备调用身份；主机软件、模板源码和每项目 CI 配置由入口处理：

1. Mac 安装 Python 3.11+、Git、OpenSSH；已有 SSH alias 能以密钥登录专用构建机，host key 已核实，远端有 `sudo -n`。入口保持严格 host key 校验，不自动接受新 key、输入密码或创建 VM。
2. 把 [`remote.json.example`](../server/deploy/ci-runner/remote.json.example) 复制到 `~/.config/webapp-template/remote.json`，权限 `0600`，填写 `ssh_host`、GitLab 地址和 token 文件路径。另一路径用 `--config`；配置和 token 必须在模板仓库之外，由当前 Mac 用户所有，token 文件权限 `0600`。
3. token 由安全编辑器或密钥管理工具提供。使用目标组 Owner token，或本人 namespace 的个人 token；需要 `api`、`create_runner`、`manage_runner`、`write_repository` scopes。入口检查 token 有效期、namespace 精确路径、Owner 身份和项目创建策略；不自动创建 namespace、提权或扩大授权。实例配额和更严格的服务端策略仍以实际创建 API 为准。
4. 构建机使用 Ubuntu 24.04 / 26.04 amd64 和 systemd，GitLab HTTPS 可直连、证书有效；软件源与官方工具下载可达。容器网络参数复用原有 `environment` / `extra_hosts` 合同，只填写在私有 Mac 配置中，不改共享 daemon 代理或系统 DNS。

| 自动阶段 | 行为与边界 |
| --- | --- |
| SSH 引导 | 核对 Ubuntu / amd64 / systemd / sudo，缺少 Python 时由 Ubuntu 软件源安装；Mac 的 Node / Go / pnpm 不参与远端初始化 |
| 授权检查 | 仅使用 GET API，检查 token 与目标 namespace；失败时不安装 Docker、不创建项目或 Runner |
| 主机准备 | 补齐 Git、curl、证书、xz、AppArmor；复用健康 Docker / Runner，缺失时安装官方 Docker 签名仓库包和校验值固定的 Runner binary |
| 工具隔离 | 固定 Node 从官方发布与 SHA256 文件安装到 `/opt/webapp-template-host-tools/`；Runner / Docker 最低版本合同见 [`host-tools.json`](../server/deploy/ci-runner/host-tools.json)，不升级或重启已有服务 |
| 源码传送 | Git bundle 仅包含当前干净 HEAD 的可达历史；按 SHA 安装到 `/opt/webapp-template-sources/<SHA>`，已有源码必须归属一致且干净，禁止覆盖 |
| 远程创建 | 复用下述 Linux 入口，目标自动分配到 `/srv/webapp-template-projects/<namespace 摘要>-<项目标识>` |
| 凭据与回执 | token 只通过加密 SSH stdin 进入本次 root-only 临时目录；正常结束、失败和 TERM/HUP 中断都清理上传目录，API token 不进入 argv、Git URL、Runner job 或 CI 变量；Mac 保存无凭据回执 |

下载和主机命令有超时；源码或权限不符、健康服务异常、下载校验失败和真实 CI 错误都会阻断。已有 Docker 数据 / 配置但缺少 binary、冲突安装包或不同 apt source 时保留现场，不自动卸载或接管。主机准备日志位于 `/var/lib/webapp-template-host/prepare.log`，权限 `0600`。

重复同一 Mac 命令会复用安装工具、精确源码和原项目状态，不重复创建项目 / Runner / pipeline。SSH 断开后远端 CI 可能继续；重跑同一参数和模板 HEAD 回读。进程被 SIGKILL 或主机断电时无法执行清理，管理员须核对 `/var/lib/webapp-template-remote/request-*` 的归属和活动进程后清理；不自动扫描删除其他调用的目录。开发机可从创建出的 GitLab 仓库正常 clone。

## 构建机上的分步入口

需要直接在已准备的 Linux 构建机调用时，继续使用原入口：

```bash
sudo python3 scripts/create-project.py \
  --config /etc/gitlab-runner-projects/host.json \
  --project your-group/my-project \
  --name '我的项目' \
  --destination /srv/projects/my-project
```

目标是构建机上的新源码目录，父目录须存在。开发机后续从新 GitLab 仓库正常 clone；命令不会覆盖当前模板、已有仓库或业务环境。

### Linux 调用前提

1. 按 [CI Runner 主机说明](../server/deploy/ci-runner/README.md) 安装 Docker、GitLab Runner 并准备 root-only `host.json`；另需 Git、Bash、Python 3.12+，以及与模板 `.n-node-version` 完全一致的 Node。Go / pnpm / QA 工具由远端 CI 按版本合同安装。
2. 构建机能够通过验证证书的 HTTPS 直连 GitLab。`host.json` 的网络参数复用于项目 Runner；管理 API token 不传入 CI job。Mac 入口会自动传入临时配置，无需在构建机逐项目投放文件。
3. `api_token_file` 使用有权在目标 namespace 创建项目、管理 Runner 和推送仓库的短期 token。组项目推荐该组 Owner access token，scopes 为 `api`、`create_runner`、`manage_runner`、`write_repository`。个人 namespace 使用有相应权限的个人 token。namespace 与授权只准备一次，不由脚本自行扩大权限。参考 [GitLab 项目 API](https://docs.gitlab.com/api/projects/#create-a-project)。
4. 在模板源仓库 checkout 已提交的版本，确认工作区与 index 干净。创建操作绑定当前 HEAD；不从已初始化的派生仓库继续创建其他项目。

token 文件须由执行用户所有、权限 `0600`；使用安全编辑器或密钥管理工具投放，避免通过命令参数、Git URL、终端历史或项目 CI 变量提供。Git HTTPS 推送通过临时 askpass 读取该文件，remote 只保存无凭据 URL，不修改全局凭据或代理配置。

## 自动执行的范围

| 阶段 | 动作与成功条件 |
| --- | --- |
| 初始化 | 归档绑定的模板 HEAD；运行原始 init 扫描、正式基础配置工具和工程骨架处理，再运行 `init --project --strict`；生成独立 main 初始提交 |
| 创建项目 | 在指定 namespace 创建私有空仓库，禁用共享 / 组 Runner；记录创建标识与 project ID |
| 接入 Runner | 复用 `setup-runner.py`；项目级、locked、protected、tag 为 `template-docker`，保护 main 并禁止 force push，等待 online |
| 首次推送 | fetch 并核对远端为空或等于本次初始 SHA；只推送本项目 main，不 force、不覆盖其他提交 |
| 等待 CI | 绑定初始 SHA / main 的首轮 push pipeline；四个必要 job 必须 success、非 allow_failure，且使用本项目 Runner |
| 制品回读 | 回读派生源码与两个镜像的 JSON，核对 source / derived SHA、pipeline ID、平台、校验值格式及 load / binary / web 成功结果 |

工程骨架复用 `configure-project.mjs` 处理身份、品牌和固定开发端口；`project-scaffold.mjs` 清空公开配置中的 DSN、JWT 和管理员密码，不生成密码，也不把合成值作为生产凭据。Compose 的私有数据库与 JWT 参数改为必填，示例环境文件保留空值；Kubernetes 与可选能力继续保留，外部示例地址使用保留的 `.invalid` 域名。

`.project-bootstrap.json` 记录模板 SHA、创建标识和 `deployment=unconfigured`。初始化 strict / CI 通过证明工程与打包基线完整；开始运行前仍须通过 `config.local.yaml` 或既有环境覆盖合同提供真实数据库、JWT 和管理员配置，随后按部署主路径执行迁移、preflight、health/ready 与业务 smoke。未配置骨架会被生产 preflight 拦截。

## 重复执行与失败恢复

本次状态和初始化日志保存在 `/etc/gitlab-project-bootstrap/<实例与项目路径摘要>/`，目录权限 `0700`、state 文件 `0600`。CLI 输出创建结果、项目 / pipeline 链接、源码 SHA、Runner ID 和回执路径；不打印 token。

| 场景 | 处理 |
| --- | --- |
| 同一命令再次运行 | 复用创建标识、初始 commit、项目、Runner 和 pipeline，重新核对结果；不创建重复项目或流水线 |
| 创建 API 结果不明 | 通过本次创建标识回读同名项目，归属一致才恢复；不接管已有其他项目 |
| 注册或 push 中断 | 已完成阶段保留；同一参数与模板 HEAD 重跑继续；Runner 自身的注册结果不明按 Runner 专题处置 |
| CI 失败 / 取消 / 缺少必要 job 或制品 | 返回非零并保留现场；真实失败不自动点击 job retry。Docker Hub 瞬断由 [构建入口](image-build.md) 作有界重试 |
| 等待超时 | 默认 3600 秒，可用 `--timeout 60..7200` 调整；只结束本次等待，远端继续；重跑同一命令读取结果 |
| 本地修改、模板版本变化、远端出现其他 commit / 分支或归属变化 | 阻断并保留现场，不 stage 用户修改、不 reset、不强推 |

首次提交前的恢复同时核对本脚本保存的文件摘要和 index 检查点；源码配置在两次检查点之间中断或出现其他写入时，保留目录与日志并阻断，不猜测改动归属。

创建结果不含真实生产配置、数据库创建、migration apply、Registry 推送或部署。脚本不会删除项目或自动清理 Runner；临时演练完成后，按 Runner 的 `--pause` 流程停用专属服务，归档演练项目并撤销临时管理 token，保留验收回执和镜像制品。

流水线及制品合同见 [GitLab CI](gitlab-ci.md)，分步初始化与按项目裁剪见 [project-init](project-init.md)。
