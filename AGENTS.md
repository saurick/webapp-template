# webapp-template 协作约定

本文件只记录模板仓库特例。通用工程、Git、删除、浏览器和文档规则使用全局 AGENTS；模板当前事实回到 current-source、project-init、deployment docs、代码和测试。

## 真源与阅读顺序

1. `docs/current-source-of-truth.md`：当前模板真源与任务分流。
2. `docs/project-init.md`：派生项目初始化、替换与裁剪。
3. `docs/deployment-conventions.md`：部署形态与主路径。
4. `README.md`、`docs/README.md`、`server/docs/README.md`、`server/deploy/README.md`、`scripts/README.md`：子系统入口。
5. `progress.md`：过程与现场，不是当前规则真源。

局部脚本注释、单份 runbook、历史记录和 GPT 规划只能作线索，不能覆盖上述真源。

## 过程记录与工作区

- 完成代码或正式文档改动后更新 `progress.md`；仅讨论可跳过。
- 更新前检查 600 行/80KiB 阈值；达到后显式归档并保留活跃事项和索引。
- 开始/收口检查 worktree；其他会话的无关改动只隔离，不回退、格式化、stage 或提交。

## 项目 Skills

- 项目 skills 位于 `.agents/skills/`，入口见其 README；只保留模板专项 SOP。
- 默认只选一个主 skill；真实跨模板边界、页面、测试或 operations 时再组合。
- runtime、可迁移观测、安全、发布和回滚统一使用 `$webapp-template-operations-governance`。
- 提示词整理显式使用全局 `$prompt-governance`；Git 收口使用 `$git-closeout-coordination`。
- fixture/admin preset/default data 规则由 domain + test 承接，不单建 seed skill。
- 修改 skill 后同步 metadata/引用并运行 validator、YAML/metadata、引用扫描和 `git diff --check`。

## 模板与派生项目边界

- 模板只保留高复用基线：初始化、Go/Kratos + React/Vite 骨架、auth/RBAC、错误码同步、health/ready、质量门禁、Compose 和可观测基础。
- 不把某个派生项目、客户、域名、业务流程、部署地址或私有凭据写入模板核心。
- 新增能力必须说明模板级复用价值、派生项目影响和迁移风险；一次性需求下沉派生项目。
- 初始化后先运行 `bash scripts/init-project.sh`，收口运行 `bash scripts/init-project.sh --project --strict`，按真实项目裁剪模板残留。
- 默认数据、admin preset 和示例配置必须可识别、可替换且无真实 secret。

## 部署形态

- `server/deploy/compose/prod` 是单机/单宿主机 Compose 主路径；不因 lab-ha 存在而 Helm 化。
- `server/deploy/lab-ha` 的第三方平台组件和实验业务部署走项目正式 Helm/Argo 路径；同一资源不长期并存 Helm/Kustomize/裸 YAML/现场 patch 多主路径。
- 应急 patch 同轮回收到仓库真源并更新 progress。
- 低配目标机只 load 制品、migration、启动和检查，不执行重构建。
- 发布前核对 preflight、commit/image、migration、config、health/ready、smoke、派生项目影响和 rollback。
- 清理先确认回滚镜像策略，不把 `image prune -a` 作为无条件默认；禁止 volume prune 和数据/证书/env 删除。

## lab-ha 与节点基线

- 值班入口优先给状态、入口、时间、异常和下一步，不把长命令墙当首页。
- 低成本关键摘要需要持久化时设置容量/条数/TTL；纯缓存可使用临时存储但不得冒充恢复真源。
- 当前 lab-ha 节点基线、swap、防火墙、multipath、SELinux 等细节以 deployment conventions/runbook 和自动化脚本为准，不在本文件复制易漂移命令。

## 数据库与迁移

- 已存在 migration 且明确命中当前本地开发库时，可按项目命令 apply 并只读确认 schema。
- 新 migration、手改 SQL、回滚、清库、大规模回填、共享/生产库或高风险锁表变更先说明并确认。
- schema/migration/ent 或依赖新列的逻辑发布前必须核对目标 migration；pending 时不得先发布依赖版本。
- 发布后 smoke 要命中新 schema 的真实业务链，不只检查 health/首页。

## 健康、可观测与错误

- 模板保留 `/healthz`、`/readyz`、数据库就绪等待和 Compose DB health dependency；额外依赖由派生项目决定。
- logs/traces/error helper 必须可迁移，不绑定单一 provider/客户；request/trace id 和结构化日志按真实链路使用。
- 服务端错误码真源、生成前端码表和手写 wrapper 按项目现有合同维护；保持一码一义。
- 前端错误通过统一 helper 输出场景化中文，不透传 raw error。
- 诊断、secret/preflight、发布证据和回滚使用 `$webapp-template-operations-governance`。

## 页面与测试

- 页面改动使用 `$webapp-template-page-design-governance`，保持模板通用、响应式和低心智负担，不加入派生业务文案。
- 按影响面运行 server/web/migration/init/health/style/loadtest/preflight；loadtest 只证明容量，不替代功能测试。
- 当前已有浏览器样式入口时覆盖默认、交互、恢复和相邻区域；仓库 fast/full 不替代目标页面回归。
- 模板健康、初始化、错误码和发布基线必须有可迁移的自动化检查。

## 文档、目录与收口

- 一级目录或长期子系统变化时同步 README/docs；根 README 管仓库导航，子目录 README 管内部职责。
- current source、project-init、deployment path、初始化行为、健康合同或派生影响变化时同轮同步正式 docs。
- 提交推送按项目双 remote 约定：默认先 `origin` 后 `gitlab`；单个 remote 失败时继续另一个并分别汇报。
- push 前 fetch 并确认 upstream；精确 stage 本轮范围，提交信息使用简体中文。

## 外部规划

GPT/ChatGPT 输出只作输入。执行前核对本文件、current-source、project-init、deployment docs、代码、测试和 worktree；冲突时按模板真源收窄为可验证切片。
