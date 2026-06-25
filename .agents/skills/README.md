# Codex 项目 Skills / Project Skills

本目录保存 webapp-template 的项目专属 Codex skills，是仓库内 canonical 版本。全局 `~/.codex/skills` 只放通用范式；涉及本项目时优先用这里的 `$webapp-template-*` skills。

## 使用入口 / Usage

| Skill | 主要用途 |
| --- | --- |
| `$webapp-template-docs-governance` | 模板文档、current source、project-init、deployment conventions、reader path 和 progress |
| `$webapp-template-page-design-governance` | 模板页面、普通用户入口、admin preset、低心智负担、响应式和 L1 回归 |
| `$webapp-template-code-review-governance` | 独立代码审查、模板残留、初始化、admin preset、RBAC、health/ready 和部署 |
| `$webapp-template-test-governance` | server/web/migration、project init、admin preset、health/ready、style:l1、loadtest 和 deploy preflight |
| `$webapp-template-prompt-governance` | 新会话、side chat、review、模板初始化、测试、部署和提交推送提示词 |
| `$webapp-template-release-governance` | 模板发布、派生项目影响、preflight、image tag、health/ready 和 rollback |
| `$webapp-template-domain-boundary-governance` | 模板自身、derived project、project-init、server/web/runtime、deploy/lab-ha 和 loadtest 边界 |
| `$webapp-template-runtime-diagnostics` | 模板运行、派生项目运行、init 输出、compose prod、lab-ha、health/ready 和 reverse proxy |
| `$webapp-template-seed-import-governance` | fixtures、admin preset、project-init 默认数据、import dry-run 和 cleanup |
| `$webapp-template-observability-error-governance` | logs/traces/metrics/error helper、health/ready、request_id 和派生项目可迁移性 |
| `$webapp-template-security-privacy-governance` | 默认 secrets、admin preset、OAuth/API examples、cert、SealedSecret、env 示例和权限边界 |

## 按问题选 Skill / Scenario Matrix

| 你现在想做什么 | 优先使用 | 它解决什么 | 不负责什么 |
| --- | --- | --- | --- |
| 选中主会话一段话，简单问“是什么 / 为什么 / 合理吗 / 怎么办” | 全局 `$selected-context-analysis` | 片段理解、短问短答、上下文边界 | 不把片段当 webapp-template 当前真源 |
| 写新主会话、side chat、review、测试、部署或提交推送提示词 | `$webapp-template-prompt-governance` | 把目标、真源、范围、验收和风险写成可执行 prompt | 不替代实际执行或验证 |
| 模板运行、派生项目运行、init 输出、compose prod、lab-ha、health/ready 或 reverse proxy 异常 | `$webapp-template-runtime-diagnostics` | 分层排查 template / derived project / runtime / deploy 差异 | 不在定位前直接补代码 |
| 判断测试是否通过、范围是否足够、要不要跑 style:l1、loadtest、deploy preflight | `$webapp-template-test-governance` | 选择 server/web/migration、project init、admin preset、health/ready 和部署检查 | 不替代代码审查结论 |
| 实现后看问题是否真的解决、改动是否对、有没有 bug / 缺测试 | `$webapp-template-code-review-governance` | 独立审查模板残留、初始化、admin preset、RBAC、health/ready 和部署风险 | 不以实现总结为主 |
| 模板文档、current source、project-init、deployment conventions、reader path 漂移 | `$webapp-template-docs-governance` | 文档真源、模板说明、派生项目读者路径和进度记录 | 不证明 runtime 行为正确 |
| 模板页面、普通用户入口、admin preset、响应式、低心智负担或 L1 回归 | `$webapp-template-page-design-governance` | 页面语义、信息层级、响应式和视觉回归 | 不直接定义 server/runtime 后端边界 |
| 模板自身、derived project、project-init、server/web/runtime、deploy/lab-ha 和 loadtest 边界 | `$webapp-template-domain-boundary-governance` | 模板职责、派生边界、真源和运行层级 | 不处理纯视觉或文案排版 |
| 模板发布、派生项目影响、preflight、image tag、health/ready 和 rollback | `$webapp-template-release-governance` | 发布路径、派生项目影响、回滚和 release evidence | 不替代 runtime 故障定位 |
| fixtures、admin preset、project-init 默认数据、import dry-run 和 cleanup | `$webapp-template-seed-import-governance` | 可逆默认数据、初始化数据边界和清理策略 | 不把模板样例写成派生项目私有事实 |
| logs/traces/metrics/error helper、health/ready、request_id 和派生项目可迁移性 | `$webapp-template-observability-error-governance` | 可观测性、错误分类、用户提示和模板可迁移证据 | 不替代安全审查 |
| 默认 secrets、admin preset、OAuth/API examples、cert、SealedSecret、env 示例和权限边界 | `$webapp-template-security-privacy-governance` | 安全与隐私边界、默认密钥和权限风险 | 不替代普通业务 review |

## 常用组合 / Pairings

| 场景 | 建议同时使用 |
| --- | --- |
| 文档改动会影响模板页面、project-init 或派生项目读者路径 | `$webapp-template-docs-governance` + `$webapp-template-page-design-governance` |
| 页面改动涉及 server、API、RBAC、runtime、deploy 或模板边界 | `$webapp-template-page-design-governance` + `$webapp-template-domain-boundary-governance` |
| 实现完成后做独立 review 或提交前自查 | `$webapp-template-code-review-governance` + `$webapp-template-test-governance` |
| 模板运行、派生项目运行或 compose/lab-ha 故障后准备发布 / 回滚 | `$webapp-template-runtime-diagnostics` + `$webapp-template-release-governance` |
| 默认数据、admin preset、secrets、权限或脱敏边界相关 | `$webapp-template-seed-import-governance` + `$webapp-template-security-privacy-governance` |

## 使用规则 / Rules

- 在 Codex 会话里直接写 `$skill-name` 即可触发，例如 `$webapp-template-docs-governance`；一次任务经常跨边界时，可以在同一条消息里同时写多个 skill。
- 先选最贴近本轮主任务的 skill，再按影响面补相邻 skill：文档 + 模板页面用 docs/page，页面 + 模板边界用 page/domain，发布故障用 release/runtime，涉及默认 secrets、admin preset 或权限再加 security。
- 涉及 webapp-template 时优先使用本目录 `$webapp-template-*` 项目版；只有缺少项目专属能力，或任务明确跨项目通用，才退回 `~/.codex/skills` 的通用版。
- 本 README 只负责选型和导航；真正执行前必须读对应 skill 的 `SKILL.md`，不要只按 README 摘要执行。
- 修改 skill 本身时同步检查 `SKILL.md`、`agents/openai.yaml`、触发名和 UI 摘要；只改目录 README 不代表更新了任何 skill workflow。

## 维护规则 / Maintenance

- 单个 skill 的入口必须是它自己的 `SKILL.md`；不要在每个 skill 子目录再加 README、quick reference 或 changelog。
- 新增或修改 skill 时保持 `name`、目录名和 UI `display_name` 英文稳定；`description`、正文、`short_description` 和 `default_prompt` 使用中文主体 + English anchors。
- 只改 skill/docs 时默认跑 skill validator、YAML 解析、`git diff --check` 和必要引用扫描，不机械运行模板全量 QA、loadtest 或远端部署。
- 修改本目录后按项目约定更新 `/Users/simon/projects/webapp-template/progress.md`。
