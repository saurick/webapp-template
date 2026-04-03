# 项目协作约定

- 每次完成代码改动后，Codex 必须更新 `/Users/simon/projects/webapp-template/progress.md`。
- 更新最少包含：完成、下一步、阻塞/风险（可空）。
- 若本次仅讨论或无文件改动，可跳过更新。
- 注释遵循“最小必要”原则：能用命名、拆函数、测试、类型或正式文档表达清楚的内容，不额外堆进源码注释。
- 代码改动必须补充“简明且关键”的注释（简体中文）：仅说明设计意图、兼容性兜底、边界条件；禁止无意义注释。优先放在关键逻辑入口与 fallback 分支。
- 若当前任务触达的文件中存在明显过期、误导或与当前代码/模板正式规则冲突的注释，应在同一轮顺手修正；不要让后续 AI 继续根据错误注释扩散误判。
- 大段注释掉的旧实现、现场补丁历史和临时兜底分支若已不再代表当前模板基线，应优先删除、改写成简洁说明或收口到正式 runbook，不要继续留在代码/脚本里充当隐藏真源。
- 提交到仓库的注释应直接描述当前模板行为、边界和依赖关系；不要写成“新增 / 修复 / 关键修复 / 保持原有代码”或带 `⭐✅⚠️` 的补丁历史口吻，这类过程信息应写进提交说明、runbook 或 `progress.md`。
- 模板行为、初始化规则、部署路径、runbook、页面文案、接口或配置发生变化时，必须在同一轮同步检查并更新相关注释与正式文档，避免模板代码先变、文档和脚本说明滞后。

## 值班可视化优先

- 面向人工日常运维、值班排障、发布巡检的能力，默认优先提供 `Portal / Grafana / Alertmanager / Hubble / Argo CD` 这类可视化入口；脚本主要承担批量校验、回归和兜底，不应成为唯一操作面。
- 新增或调整平台能力时，若这项能力会被人频繁查看或判断状态，应同步补入口卡片、dashboard、摘要信息或 runbook 深链，至少让值班人先看到 live 状态，再决定是否执行脚本。
- 只有明显属于一次性批处理、无人值守自动化或纯开发者工具的场景，才可以只提供脚本而不补可视化入口。

## 轻量运维数据持久化

- 对值班排障有直接价值、体量可控且长期运行不会明显抬高存储成本的数据，不得默认只放在内存或 `emptyDir`；应优先落到小规格 PVC 或对象存储，例如最近告警 payload、轻量 trace、最近一次巡检/烟雾结果摘要。
- 这类持久化必须同时给出容量上限、保留条数或 TTL，避免把“应该留痕”做成无限堆积。
- 纯缓存、可快速重建的临时目录或日志缓冲可以继续使用 `emptyDir` / 内存，但要在配置或文档里明确它不是恢复真源。

## 节点基线硬要求

- `lab-ha` 节点上的 `swap` 不是“建议关闭”，而是必须持久关闭；除了 `swapoff -a`，还必须同步清理 `/etc/fstab` 或等效启动项，确保节点重启后不会把 swap 再挂回来。
- 当前 `Ubuntu 24.04` 实验节点默认不保留主机防火墙模糊态；`ufw` / `firewalld` 要么完全按端口矩阵受控，要么默认关闭。对当前 `lab-ha`，基线口径是关闭主机防火墙，避免 `Cilium / NodePort / Longhorn / 管理入口` 在重启后被主机规则重新拦住。
- 当前 `lab-ha` 的 Longhorn 节点默认不运行 `multipathd`；若节点并未明确承载 SAN/多路径存储，应持久关闭 `multipathd.service` 与 `multipathd.socket`，避免 Longhorn 命中官方已知问题并在全量冷启动后卡住卷恢复。
- 当前这套 `lab-ha` 节点不使用 SELinux；如果后续改成 `RHEL / Rocky / AlmaLinux` 节点，必须在 runbook 里显式写清 `permissive / enforcing` 口径并实测，不要在未验证时把“SELinux 开着也行”当默认前提。

## Git 推送约定

- 当前仓库默认发布 remote：`origin`、`gitlab`。
- 当用户明确要求“推送代码”“提交推送”等时，默认将当前提交依次推送到 `origin`、`gitlab`；不要只依据当前 upstream 决定单个推送目标。
- 推送顺序默认先 `origin` 后 `gitlab`：`origin` 作为更稳定的外部托管优先落地，`gitlab` 作为本地部署镜像随后同步。
- 若某个发布 remote 推送失败，不要因为单个 remote 失败而跳过其后的其他发布 remote；应继续尝试剩余发布 remote，并在最终回复中逐一说明成功/失败情况。
- 若 `gitlab` 因本地服务离线、网络不通、SSH 拒绝等原因失败，但 `origin` 已成功，不视为需要回滚的失败场景；按“部分成功”汇报，并提示后续补推 `gitlab`。
- 若仓库存在其他 remote，默认不推送，除非用户明确要求，或本文件已将其列入发布 remote。
- 若用户明确要求“只推 GitLab”“只推 GitHub”或指定 remote/分支，严格按用户要求执行，不自动补推其他 remote。

## 模板文档阅读优先级

- 涉及“如何把模板收口成当前项目”、哪些默认模块该保留/删除、哪些模板语义必须替换时，必须先阅读：
  - `/Users/simon/projects/webapp-template/docs/project-init.md`
  - `/Users/simon/projects/webapp-template/docs/README.md`
  - `/Users/simon/projects/webapp-template/README.md`
- 涉及部署路径、Compose 与 `lab-ha` 边界、`Helm / Kustomize / Argo CD` 真源时，必须继续阅读：
  - `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`
  - `/Users/simon/projects/webapp-template/server/deploy/README.md`
  - `/Users/simon/projects/webapp-template/server/docs/README.md`
- 涉及服务端运行、配置、接口、可观测性、数据库迁移时，应以 `/Users/simon/projects/webapp-template/server/docs/README.md` 为索引，继续阅读对应专题文档，而不是直接凭印象修改。
- 文档优先级固定为：
  - 当前模板初始化与裁剪规则：`docs/project-init.md`
  - 当前部署真源与边界：`docs/deployment-conventions.md`
  - 子系统专题说明：`server/docs/README.md`、`server/deploy/README.md`、`scripts/README.md`
  - 逐日过程记录与现场收口：`progress.md`
- 禁止把 `progress.md` 单独当成模板当前规则真源；它只能补充演进原因、现场操作和未完全回收的历史痕迹。
- 当 `README / docs / progress.md` 之间出现冲突时，默认先以 `docs/project-init.md` 和 `docs/deployment-conventions.md` 为准；只有用户明确要求按历史现场口径复盘时，才回到 `progress.md` 或 live 现状逐条核对。
- 涉及模板逻辑或部署规则复查时，局部脚本注释、单份 runbook 或某次现场记录只能作为线索，不能覆盖这里定义的文档优先级；发现冲突时应同步修正文档或注释。

## 数据库迁移执行边界

- 若问题已经明确定位为“当前开发库 schema 落后于仓库中已存在的迁移”，且目标库来自当前仓库的开发配置（如 `server/configs/dev/config.yaml`、`server/configs/dev/config.local.yaml`）或用户明确指定的非生产库，AI 应直接执行 `cd /Users/simon/projects/webapp-template/server && make migrate_apply`，随后执行仓库当前实际提供的 schema 校验；若仓库没有固定 `db_schema_check` 目标，则至少用 `migrate_apply` 成功输出加只读 schema 查询确认结果。这类“补齐现有迁移”的动作默认不需要再次征求确认。
- 执行前必须先确认本次命中的数据库来源，避免把本地 shell 里的历史 `DB_URL`、`USE_ENV_DB_URL=1` 或其他环境变量误当成当前开发库；若仓库和环境变量同时存在连接配置，应先按仓库既有规则判断实际优先级，再执行迁移。
- 只有在“迁移文件已经存在于仓库、当前任务只是把开发库补到代码所需 schema”这一类场景下，才允许默认直接 apply；若需要新生成 migration、手改 SQL、回滚迁移、清库、删数据，或需要做大规模数据回填，仍应先说明方案与风险。
- 若目标库可能是生产库、共享测试库、多人共用环境，或者当前无法从配置明确判断数据库归属，必须先向用户说明将命中的库和潜在影响，再等待确认；不要在库归属不清时凭感觉直接迁移。
- 若迁移包含删除列、重命名列、修改约束、重写默认值、锁表时间不可忽略等高风险变更，即使目标是开发库，也应先在回复里说明风险点，再决定是否继续。

## 线上迁移联动约束

- 只要本轮变更触达 `server/internal/data/model/migrate/*`、`server/internal/data/model/schema/*`、`server/internal/data/model/ent/*`，或服务端新逻辑开始依赖新表 / 新列 / 新索引，发布前必须核对目标环境 migration 状态，不能只看代码已经生成了 migration 文件。
- 仅有 migration 文件纳入版本管理还不够；若目标库仍有 pending migration，默认禁止继续发布依赖该 schema 的服务版本，除非同一轮先完成 apply。
- 模板仓库的 `publish_server.sh` 若已提供线上 migration 检查或 apply 能力，优先走脚本默认门禁；不要把“先发代码、再手工补库”的高风险流程继续留给派生项目。
- 发布后 smoke 不能只停留在 `healthz/readyz/首页`；若本轮功能依赖新 schema，至少补一条命中新表 / 新列链路的真实业务 RPC、页面回归或只读查询，确认不是“服务活着，但业务一进来就因缺表报错”。

## 前端样式改动与验证

- 处理页面样式、布局、间距、字体、图片、图标或表格内容问题时，默认先连真实浏览器或真实页面运行时定位，不要只凭静态代码或截图猜。
- 改动前必须先确认：当前到底是哪条规则在生效、改完准备由哪条规则接管、会影响哪些相邻 box、父子容器、兄弟节点或响应式断点。
- 遇到遮挡、溢出、重叠、误隐藏、错位时，必须显式检查 box 关系，而不只看当前节点自己：至少确认父子包含、兄弟相邻、`overflow`、`min/max-size`、`flex-shrink`、`white-space`、`word-break`、`object-fit`、`position`、`z-index`、`transform` 和关键 `gap/padding/margin`。
- 不能只验证默认内容。若区域内有长文本、大数字、标签、图片或其他 media，至少补一组边界样本，确认不会把容器撑爆、裁切相邻区域或被相邻布局挤到不可见。
- 本仓库目前没有固定的 `style:l1/l2/l3` 浏览器脚本入口；因此前端样式任务默认要同时做两件事：1) 浏览器级手工/自动回归，确认默认态、交互态、恢复态和相邻区域；2) 执行当前已有质量命令 `cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test`。
- 名词不要混用：这里说的“回归”是验证某次改动没有把既有页面、状态、相邻区域和关键交互带坏；这里说的“冒烟”只保留给更粗粒度的主路径可用性确认。当前仓库里，`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh` 更接近“粗粒度冒烟/快速检查”，`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh` 是仓库级全量 QA，都不能替代浏览器级样式回归。
- 若某个高频页面的样式问题反复出现，应优先在该仓库补固定浏览器 fixture 或自动化脚本，而不是长期依赖人工口头回归。

## 服务端可观测性约束

- 新增或修改服务端链路（HTTP / gRPC / JSON-RPC / 定时任务 / 数据写路径）时，必须同时检查 `trace` 和 `log` 是否打全打对。
- 自定义 HTTP handler 必须走统一观测包装，禁止直接裸挂路由；若存在 fallback / panic 风险，必须补 recover 后的错误日志与 error span。
- 成功、业务失败、系统失败三类分支都必须有结构化日志；可获取时日志至少带 `request_id`、`trace_id`、`operation` 和关键业务字段。
- 日志优先使用结构化字段，避免只写不可检索的纯文本拼接；禁止记录密码、完整 token、密钥等敏感明文。
- 新增关键链路或修复观测性缺口时，至少补一条对应的观测性回归测试，覆盖正常路径或关键兜底路径。
- 最终回复需单列“观测性检查结果”或明确说明剩余盲区，不能只汇报功能改动。

## 模板健康检查边界

- 本模板默认保留最小健康检查骨架：`/healthz`、`/readyz`、启动阶段的数据库就绪等待，以及 `compose` 中数据库服务的 `healthcheck + depends_on: service_healthy`。
- 模板层默认只检查“最常见且几乎所有派生项目都会依赖”的硬依赖；当前通用基线是 PostgreSQL，`/readyz` 不应预埋 Redis、MQ、OSS、第三方 API 等项目特有依赖。
- 模板层建议补齐健康检查的最小回归测试，以及 `readyz` 失败时的结构化日志；这些属于低成本高复用的基线能力。
- 业务容器自身的 `compose healthcheck`、额外依赖的就绪检查、复杂 `/health/details`、K8s probe 与告警策略，默认下沉到派生项目按部署形态和真实依赖决定，不要在模板里过度预埋。
- 若派生项目长期使用 `docker compose` 且日常运维依赖容器 `healthy/unhealthy` 状态，可在派生项目中为业务容器补 `healthcheck`；若仅做人工发布与最小巡检，可继续沿用模板默认骨架。

## 派生项目初始化流程

- 当仓库由模板初始化为新项目后，第一步先执行 `bash scripts/init-project.sh`，按输出处理项目名、密钥、部署主机、文档措辞与模块裁剪点。
- 完成初始化收口后，必须再执行 `bash scripts/init-project.sh --project --strict`，确认不存在遗漏的模板残留。
- 初始化阶段优先保留：质量门禁、错误码治理、最小健康检查、基础可观测性与通用鉴权骨架；不要因为“像模板”就顺手删掉这些基线能力。
- 初始化阶段若要删除未使用的部署物或模块，默认移动到系统回收站；尤其是 K8s 清单、远端发布脚本、示例后台业务页，应按当前项目真实需求裁剪。

## 部署真源约定

- `server/deploy/compose/prod` 继续是单机/单宿主机的 `Compose` 主路径，不适用 `lab-ha` 这套 Helm 规则；不要因为看到项目级部署约定文档，就反推 Compose 也需要 Helm 化。
- 先判断当前改动目标的主路径：模板默认骨架走 `Kustomize`，`server/deploy/lab-ha` 的第三方平台组件与实验业务部署走 `Helm`。
- `server/deploy/lab-ha` 内同一资源禁止长期并存 `Helm / Kustomize / 裸 YAML / 现场 patch` 多个主路径；应急 patch 允许先止血，但同一轮必须回收到仓库真源，并更新 `progress.md`。
- `lab-ha` 的第三方组件统一通过 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/helm-release.sh` 管理；新增或修改 release 时，优先补 values / chart / Argo source，而不是继续堆新的手工 apply 路径。
- `lab-ha` 下保留在 `manifests/` 的平台自定义 YAML，若已由 `charts/lab-platform` 接管，则这些文件只作为原始内容来源与文档落点，不再视为独立安装入口。
- `webapp-template` 在实验环境中的 `lab / prod-trial / internal` 形态统一走 `server/deploy/lab-ha/charts/webapp-template`；不要再为同一业务资源新增新的 Kustomize overlay 作为主路径。
- 部署路径变更时，必须同步检查 Argo CD `Application.source`、runbook / README / handover、验证脚本，避免文档、GitOps、live 集群三方漂移。

## 错误码约定

- 服务端错误码唯一来源：`server/internal/errcode/catalog.go`。
- `web/src/common/consts/errorCodes.generated.js` 是生成产物，只承载原始 `RpcErrorCode`，由 `scripts/gen-error-codes.mjs` 维护，禁止手改；`scripts/qa/error-code-sync.sh`、`pre-commit`、`fast/full` 必须保持开启。
- `web/src/common/consts/errorCodes.js` 是手写消费层 wrapper，模板内只保留通用消费逻辑（如鉴权分组、默认文案与 `isAuthFailureCode(...)`）；派生项目的业务特例应下沉到派生仓库，不要反写回模板通用层。
- 除错误码目录、前端错误码常量文件、测试文件、文档外，禁止在业务代码中直接写 3 到 5 位错误码魔法数字。
- 新增或修改错误码时，必须同时检查并按需更新：
  - 服务端错误码定义
  - 前端生成码表与消费层逻辑
  - 相关测试与文档
  - `progress.md`
- 必须保持“一码一义”，禁止复用已有错误码表达新语义。
- 前端只有统一函数 `isAuthFailureCode(...)` 可以触发自动登出；权限不足不得触发登出。
- 提交前若涉及错误码相关改动，应执行 `bash scripts/qa/error-code-sync.sh` 与 `bash scripts/qa/error-codes.sh`。

## 前端错误提示约定

- 前端用户可见错误提示禁止直接显示 `err.message`、`e.message` 或其他原始英文异常。
- 已知错误码、鉴权错误、网络错误、`HTTP error xxx`、`JSON-RPC error` 等 transport 文案，统一通过 `web/src/common/utils/errorMessage.js` 的 `getUserFacingErrorMessage(...)` 收口翻译。
- 标准“动作 + 失败，请稍后重试”场景优先使用 `getActionErrorMessage(err, '登录')`、`getActionErrorMessage(err, '保存')` 这类动作型 helper；只有需要特殊文案时再直接传 `fallback` 给 `getUserFacingErrorMessage(...)`。
- `errorMessage.js` 负责“已知错误翻译”，页面调用点负责“当前场景最终兜底文案”；不要把场景文案堆回通用错误码表，也不要继续散落 `err?.message || ...` 这类写法。
