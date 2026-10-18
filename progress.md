# 模板进展

当前事实以 `docs/current-source-of-truth.md`、`docs/project-init.md`、`docs/deployment-conventions.md`、代码和测试为准；本文只保留当前模板交付进展。

## 2026-10-18 空白构建机首次安装

- 独立官方 Ubuntu VM 的首次实测命中 APT 可选命令查询索引与必要发行索引代理 502；主机引导与安装仅下载所需索引，保留签名校验和 HTTP(S) 超时。主机 update 对 URL 配对的网关错误最多重试 3 次，真实签名 / 包错误及重试耗尽继续阻断。
- 缺失 Docker 时，在新 daemon 首次启动前接入 root-only 私有代理；已有服务与外来 drop-in 不接管。首次安装、重复复用、真实 APT 失败、Runner 下载校验和外来配置保护由专项回归守住。
- 冷启动实际安装通过 Docker / Runner 后，Node 官方下载命中 curl TLS 瞬断；工具下载改为最多 3 次的明确传输错误恢复，证书 / 认证 / 写入 / 校验及未知错误不重试，回归同时覆盖恢复和耗尽。
- 空白前置状态、Mac 命令、安装日志、首轮项目 CI、制品回读与临时资源回收证据保存在忽略的 `output/blank-vm/`；以实际终态回执为准，mock 回归不替代真实 VM 验收。

## 2026-10-18 Mac 一键创建与主机准备

- Mac 入口封装严格 SSH、namespace 只读授权检查、缺失工具安装、精确模板 bundle 传送、Linux 项目创建与首轮 CI；配置 / token 在仓库外，上传凭据按请求清理，已有服务复用且不升级重启。
- 权限、接收失败 / 信号清理、源码归属与工具重复准备由专项回归守住；从零临时 namespace / 项目、完整 CI 和清理回执保存在忽略的 `output/mac-bootstrap/`，实际终态以远端 pipeline 与下载制品为准。

## 2026-10-18 新项目统一创建入口

- 串联私有 GitLab 项目创建、正式模板配置 / 初始化 strict、专属 Runner 注册、初始 commit 推送、首轮 CI 与制品元数据回读；状态绑定模板 SHA、创建标识和目标目录，失败保留现场供同命令恢复。
- 工程骨架清空公开凭据、保留 Compose / Kubernetes 与基础能力，明确部署未配置；不使用演示凭据或新增管理员密码覆盖。临时 namespace / 项目从零验收与资源收口记录保存在忽略的 `output/project-bootstrap/`。

## 2026-10-18 新项目 CI 一键接入

- 镜像 Make 入口增加 Docker Hub 网络瞬断的有界恢复：结构化 BuildKit 失败步骤与终态共同判定，最多 3 次；编译、权限、校验、未知错误和取消继续阻断。CI 保留逐次日志及结果，失败也上传；恢复与完整流水线证据另存忽略的 `output/image-retry-delivery/`。

- 增加项目级 Runner 初始化脚本与私有 host 配置示例，统一 Runner 注册、默认分支保护、网络环境、独立 systemd 服务和 online 回读；重复执行复用本脚本 Runner，保留其他项目配置。
- 增加幂等、主机失败恢复、权限 / 归属漂移、活动 job、凭据脱敏回归，接入 strict；使用临时派生 GitLab 项目验收真实注册与完整流水线，终态与清理记录保存在忽略的 `output/runner-init/`。

## 2026-10-18 远端 CI 基线

- 增加项目专用 Docker Runner 合同，保持已有 Runner 配置独立，job 不挂载宿主机 Docker socket；镜像阶段采用 TLS rootless DinD 和受限的官方 service 权限。
- 流水线扩为模板 strict、离线派生初始化 / strict、模板镜像、派生镜像四个必要任务。派生 bundle 绑定 source / derived SHA 和 pipeline；制品包含校验值与 save / load 回验。
- 工具缓存与镜像上下文隔离，CI Go 镜像加入版本一致性检查；镜像 Make 入口不再要求宿主机 Go SDK。
- 远端终态与现场资源记录以实际 GitLab pipeline / job 和忽略的 `output/ci-delivery/` 为准，不把 Runner online 或本地检查写成远端成功。

## 2026-10-17 通用基线与历史残留收口

- 初始化：基础配置工具统一项目身份、品牌与固定端口；bootstrap / doctor 按仓库工具链合同运行，派生项目以 init --project --strict 与 strict 收口。
- 安全与镜像：Go 依赖及工具链已升级并验证可达漏洞为 0；完整 Linux 镜像构建、导出加载和隔离运行演练已完成，构建与代理排障见 image-build 文档。
- 模板边界：移除个人实验室的 205 个部署、平台、密文与运行文件，并移除旧过程归档；删除范围已在本机 Git 元数据中保留备份。Compose、通用 K8s、auth/RBAC、健康检查、迁移与质量门禁保留。
- CI 与压测：默认 GitLab CI 运行模板质量检查；压测显式选择目标并手动启动，报告统一写入 output/loadtest。默认 CI 不连接个人节点或自动部署。
- 凭据：当前包源配置不含旧 FontAwesome 认证；默认检查全部已跟踪源码与未忽略的新文件，覆盖继承配置。历史明文按不应继续分发处理，不依赖用户猜测其是否仍有效；旧提交清理和远端同步分别留证，不以当前文件删除冒充历史清理或凭据撤销。
- 验证与 Git：专项回归、模板 strict、全量当前源码密钥扫描均已通过；干净初始提交、派生项目与镜像继续独立验证；旧历史清理与双远端回读单独留证，不将当前文件删除当作历史清理结果。

- 运行回验补充：框架与 dispatcher 的 RPC 参数日志泄露已复现，并通过 GET/POST 成功/失败与业务处理不变的回归；使用 Kratos 已有 Redacter 扩展，只保留请求元信息。过期 Redis 注释和两份不再使用、携带旧凭据示例的独立工具一并移除，数据库检查继续走 dburl、Atlas 与 readyz。

- 镜像网络补充：冷构建确认默认 Alpine CDN 在宿主和容器均出现 TLS EOF，额外传 RUN 代理仍不能修复该路径。构建新增显式 HTTPS Alpine 镜像源参数，保持同版本和签名校验；包安装移到 Git 元数据之前以避免重复网络依赖。实际镜像与运行结果另行回验，不修改代理节点或共享引擎。
