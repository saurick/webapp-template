# 新项目初始化指南

本文档用于说明：当你把 `webapp-template` 复制成一个新仓库后，应该如何快速把模板收口成“当前项目”。

推荐入口是先扫描，再用 `configure-project.mjs` 预览并写入基础配置，最后补齐项目真实配置、裁剪模块并运行严格扫描。基础配置不会创建数据库、执行迁移、生成管理员密码或连接部署目标。

## 目标

- 尽快替换模板残留，避免后续开发继续沿用旧项目名、旧部署地址、旧账号配置。
- 保留模板里真正通用、低成本且高复用的工程基线。
- 让 AI 在初始化后的第一轮改动里就有明确边界，不再靠人工补口头约定。

## 推荐流程

### 1. 先跑初始化扫描

```bash
cd /path/to/your-project
bash scripts/init-project.sh
```

这个脚本会分两类输出：

- 必须处理：项目名、服务名、配置文件中的默认凭据、远端主机、模板文档语义等。
- 建议确认：K8s 残留、远端发布脚本、Jaeger、后台业务骨架等。

### 2. 统一基础配置

以下命令在新项目目录执行，默认只预览文件列表：

```bash
node scripts/configure-project.mjs --project-id my-project --name '我的项目'
node scripts/configure-project.mjs --project-id my-project --name '我的项目' --write
```

项目标识使用不超过 48 字符的小写英文、数字和连字符。项目名称为 1–40 字符的普通文本，不含控制字符、尖括号、反引号或美元符号。也可从模板目录使用 `--root /path/to/my-project` 指向已复制的新项目；写入时禁止直接使用名为 `webapp-template` 的源目录。

| 配置范围       | 自动处理                                                                | 后续真源                                                                          |
| -------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 项目标识与品牌 | package 名称、构建标题、公开运行时品牌、服务名、镜像默认名              | `web/package.json`、`web/.env.*`、`web/public/app-config.js`、服务与 Compose 配置 |
| 固定开发端口   | 扫描兄弟仓 manifest，分配并同步 dev YAML                                | `config/dev-ports.env`                                                            |
| 本地开发连接   | DSN 改为本项目数据库名与 loopback 占位连接，关闭模板远端 trace endpoint | `server/configs/dev/config.yaml`；真实连接按配置覆盖合同提供                      |
| 文档路径       | 更新正式入口的项目标识，将模板作者机器上的绝对路径改为仓库相对路径      | README、根级 docs、server docs 与 Compose 入口                                    |

预览不输出配置值。写入前会核对全部文件是否仍与计划一致；缺少必需配置、使用符号链接或文件变化时阻断。再次执行相同项目标识时保留当前配置与端口；已有其他项目标识时拒绝重新初始化。Go module `server`、权限与业务模型、管理员账号密码、本地覆盖配置、部署地址与历史记录由项目自行维护。现有 Skill 目录及引用保持一致；模板只放行 loopback 开发库；共享远端开发库须按 `server/docs/development-database.md` 完整登记实例身份并补测试，严格扫描会继续提示残留。

### 3. 完成项目收口

优先处理以下内容：

- 项目名、服务名、镜像名、容器名、页面标题
- README / AGENTS / 首页文案中的模板措辞
- 默认密钥、数据库密码、默认管理员账号；管理员用户名和密码以 `config.yaml` / `config.local.yaml` 为准，不要在初始化时额外生成 `WEBAPP_ADMIN_PASSWORD` 这类环境变量覆盖
- 远端发布主机、目录、compose 文件名
- `server/deploy/` 下 Compose / K8s 部署模板里的占位符、域名、镜像仓库和命名空间
- 是否保留 K8s / Jaeger / 远端 SSH 发布脚本
- 后台默认按 admin preset 保留 antd 简约后台、账号目录、角色权限概览和 basic RBAC 服务端权限校验；积分、订阅、层级管理、邀请码等业务模块已从模板主干移除，若项目需要，应在派生项目按真实需求新增

说明：

- 通用工程能力建议保留：质量门禁、错误码治理、最小健康检查、基础可观测性。
- 不需要的部署方式或模块，默认移动到系统回收站，不做不可恢复删除。
- 当前模板已提供完整的 Compose 与 Kubernetes 部署骨架；入口说明见 `server/deploy/README.md`，K8s 细节见 `server/docs/k8s.md`。
- 初始化默认管理员时，优先让服务端读取配置文件里的 `data.auth.admin`；如果确需调整账号或密码，直接改对应环境的 config，并在交付说明里写明登录口径，不要用随机环境变量覆盖 config。

### 4. 跑本地环境与质量检查

```bash
bash scripts/bootstrap.sh
bash scripts/doctor.sh
bash scripts/init-project.sh --project --strict
bash scripts/qa/strict.sh
```

基础配置命令已经包含固定端口分配。只需分配端口时，仍可执行 `bash scripts/init-project.sh --project --allocate-dev-ports --project-id <项目标识>`。分配器扫描父目录下兄弟仓库的 `config/dev-ports.env`，写入当前项目的 Vite、HTTP、gRPC、样式回归和独占 100 端口辅助区间，并同步 dev YAML 的直接启动 fallback；审计会阻断 manifest / YAML 漂移及正式文档复制端口数字，失败前不写入。主入口后续遇到占用会失败，不会自动顺延，临时进程也只能在本项目区间内探测。

`bootstrap` 会先核对 `.n-node-version`、`web/package.json` 的 `engines.node` / `packageManager` 和 `server/go.mod`，并检查 Dockerfile / Makefile 的 Node / pnpm / Go 默认值，再按锁文件安装依赖。`doctor` 对版本不匹配返回失败；它不自动切换本机工具。初始化扫描也覆盖公开运行时品牌与 dev/prod 本地覆盖文件，只打印命中文件和行号，避免将 DSN、密码或 token 写入终端记录。`config.local.yaml` 保持在 Git 忽略范围内。

新项目收口以 strict 为完整工程门禁：包含工具版本、脚本与前端静态检查、初始化回归、密钥扫描、Go 可达漏洞扫描、web/server 测试与构建。开发期可使用 fast；strict 的本地通过与实际数据库初始化、镜像发布及目标环境验收分别留证。

### 5. 验证镜像打包

```bash
make -C server build_server
```

默认构建 `linux/amd64` 镜像并加载到本机，不执行推送或旧镜像清理。需要独立代理构建器时传入 `BUILDER`；镜像仓库用 `IMAGE_REGISTRY`，不要复用 Docker daemon 的 `DOCKER_HOST`。完整参数、Docker Hub EOF 排障和制品验证见 [`image-build.md`](image-build.md)。

### 6. 接入远端 CI

按 [`gitlab-ci.md`](gitlab-ci.md) 注册匹配 `template-docker` 标签的项目专用 Runner，并保持主分支保护。默认流水线会对模板与离线派生样例分别执行 strict 和镜像打包，交付含校验值的镜像归档。新项目复制的是通用流水线；Runner token、节点、代理和真实部署凭据由该项目单独配置。

## 模板里通常建议保留的能力

- `/healthz`、`/readyz` 与数据库启动就绪等待
- 错误码统一治理与同步校验
- `pre-commit` / `pre-push` / `doctor` / `fast` / `full` / `strict`
- 登录、注册、管理员登录、账号目录与通用鉴权骨架
- antd admin preset 与 basic RBAC 骨架；若当前项目不是后台项目，应按需裁掉后台页面和 admin preset 文案
- 统一路由失败恢复、异步状态、浅色 / 深色主题和公开运行时品牌配置
- 基本日志 / trace 约束

## 模板里通常按需裁剪的能力

- K8s 部署清单与 dashboard
- Jaeger / OTLP / Prometheus 相关 compose 服务
- 远端一键发布脚本与默认 SSH 发布流程
- 任何项目特有的会员体系、邀请码体系、组织层级、积分体系
- 默认关闭的移动工作队列、审计、附件、打印与历史扩展；只有接入正式接口后才启用

## 给 AI 的标准输入模板

下面这份模板适合在“基于当前仓库初始化新项目”时直接发给 AI。

使用原则：

- 先说清楚哪些工程基线必须保留，再说哪些业务页面和模块要替换。
- 能明确的尽量明确，尤其是项目名、角色、页面、部署方式、第三方依赖。
- 如果当前项目暂时没有完整信息，也要至少把“不需要什么”写清楚，避免 AI 默认保留过多模板内容。

### 1. 推荐先准备的信息

- 项目基础信息：项目名、行业、目标用户、品牌风格、语言风格
- 前端信息：需要哪些页面、是否保留注册、是否区分用户/管理员、首页定位、后台菜单
- 后端信息：核心实体、用户体系、鉴权方式、是否保留 JSON-RPC、是否有 Redis / OSS / MQ / 第三方 API
- 部署信息：只用 Compose 还是也要 K8s、镜像仓库、域名 / IP、数据库 / 缓存、是否保留 Jaeger / OTel
- 收口边界：哪些模板能力必须保留，哪些默认页面 / 模块 / 文档必须删除或替换

### 2. 可直接复制给 AI 的输入模板

```text
请基于当前仓库初始化一个新项目，不要把模板默认页面和示例文案直接当成最终业务内容保留。

项目基础信息：
- 项目名：
- 英文名 / 服务名：
- 行业 / 业务类型：
- 目标用户：
- 品牌风格 / 主色：
- 页面语言风格（例如：全中文 / 中英双语）：

前端需求：
- 是否保留普通用户注册：
- 是否保留管理员后台：
- 是否启用 antd admin preset / basic RBAC：
- 首页要改成什么：
- 需要哪些主要页面：
- 登录页 / 注册页 / 后台首页是否重做：
- 是否优先移动端：

后端需求：
- 核心实体：
- 用户角色：
- 是否继续使用 JSON-RPC：
- 是否需要 Redis / OSS / MQ / 第三方 API：
- 是否需要保留默认管理员自动初始化：

部署需求：
- 部署方式：Compose / Kubernetes / 两者都保留
- 运行环境：开发 / 测试 / 预发 / 生产
- 数据库：
- 缓存：
- 镜像仓库 / 域名 / 服务器信息：
- 是否保留 Jaeger / OTel：

模板收口要求：
1. 先执行 bash scripts/init-project.sh 并按输出处理所有必须项；
2. 保留通用工程基线：质量门禁、错误码治理、最小健康检查、request_id/trace/log、Compose/K8s 部署骨架、文档结构；
3. 替换所有模板语义：项目名、服务名、镜像名、容器名、页面标题、首页文案、后台说明、部署占位符、示例地址、默认密钥；默认管理员账号密码只改配置文件，不新增随机环境变量覆盖；
4. 前端展示层按本项目需求调整，但优先复用现有鉴权骨架、请求封装、错误码消费层和通用组件；
5. 删除当前项目不需要的页面、业务模块、部署方式和示例文案，默认移动到系统回收站；
6. 明确告诉我：保留了什么、替换了什么、删除了什么、还缺什么信息；
7. 项目创建时先执行 bash scripts/init-project.sh --project --allocate-dev-ports --project-id <项目标识>，最后执行 bash scripts/init-project.sh --project --strict、bash scripts/qa/strict.sh，并汇报结果。
```

### 3. 信息不全时的最小版输入模板

如果你刚接项目，信息还不完整，可以先用这一版：

```text
请基于当前模板初始化一个新项目。

已知信息：
- 项目名：
- 行业：
- 主要用户：
- 是否保留注册：
- 是否保留管理员后台：
- 部署方式：Compose / Kubernetes / 未定

要求：
1. 先执行 bash scripts/init-project.sh；
2. 保留工程基线：鉴权骨架、错误码、健康检查、基础可观测性、质量门禁、部署骨架；
3. 替换模板项目名、页面文案、服务名、镜像名、容器名、默认密钥和部署占位符；默认管理员账号密码沿用配置文件真源；
4. 删除明显不属于当前项目的默认页面、文案和模块；
5. 把不确定但需要我确认的事项单独列出来，不要擅自补太多业务语义；
6. 最后执行初始化检查和 QA 命令，并汇报结果。
```

### 4. AI 输出时最好包含的内容

- 本次保留的模板基线
- 本次替换掉的模板内容
- 本次删除的页面 / 模块 / 部署物
- 当前仍缺失、需要人工确认的信息
- 已执行的检查命令和结果
