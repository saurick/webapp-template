---
name: webapp-template-page-design-governance
description: 项目页面设计治理（webapp-template）。Use when Codex designs, reviews, simplifies, or implements webapp-template pages, frontend UI, landing/home pages, user login/register pages, admin-login, admin-menu, admin-accounts, admin-rbac, antd admin preset pages, forms, tables, cards, filters, empty/error/loading states, responsive layout, dark/light readability, page feature semantics, browser style regression, prototypes or screenshots, or when the user mentions webapp-template with 页面设计, 简洁易用, 美观, 心智负担, 信息密度, 一眼看不懂, 功能细节, 页面好看, 样式回归, style:l1, or 低密度.
---

# Webapp Template 页面设计治理 Page Design Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 把 `webapp-template` 的页面做成可复用、低心智负担、容易派生的模板基线。不要把某个派生项目的品牌、业务字段或客户口径写进模板主干。

## Webapp Template 页面质量门禁 Page Quality Gate

页面治理不能只追求好看或少一点。要把每个可见模块、字段、按钮、状态和文案压回真实业务意义。

### 结构质量检查 Structure Quality Checks

- 边界清晰、合理严谨：说明本轮管什么、不管什么、依赖哪个真源，以及为什么当前拆分、抽象和验证足够但不过度。
- 语义清晰：模块、字段、按钮、状态、指标和提示必须让用户一眼知道它是什么、能做什么、会触发什么后果。
- 职业任务文案：用户可见标题、按钮、空态、错误提示、字段说明和帮助入口必须贴近目标岗位的业务语言，说明用户要做什么、完成后影响什么；非开发、诊断或权限配置页面不暴露 schema、usecase、payload、RBAC、API、真源等工程术语。
- 模块化：页面按主任务、数据/动作 hook、表格、表单、详情、状态和反馈拆分；只有能降低理解、复用或回归成本时才拆。
- 高内聚：同一字段展示、状态解释、操作入口、错误提示和布局规则尽量收口到共享组件/helper，不让相邻页面各写一套。
- 低耦合：页面只提交用户意图并展示后端事实，不把 RBAC、业务事实、部署或客户配置硬编码进局部 UI。
- 单一职责：一个组件不要同时承担布局、数据请求、权限裁决、业务派生、保存副作用和兜底；必要时先抽 hook/helper。

- 每个元素都要支持明确角色、判断、动作或反馈；无决策价值、重复入口、假快捷方式和装饰性卡片应删除、合并或降级。
- 页面不能补造后端事实、隐藏 API/RBAC/业务边界缺口、显示裸技术字段，或用页面私有映射替代共享 helper / API 合同。
- 降低信息密度必须通过信息分组、任务优先级、可读标签和可验证交互完成，不能隐藏必要状态或吞掉错误。
- 样式、布局和交互要覆盖默认态、交互态、恢复态、长文本/大数字/多标签、暗色/移动端和相邻区域；共享组件按影响面升级验证。

## 工作流 Workflow

1. 先确认页面角色和模板边界。
   - 运行 `git -C /Users/simon/projects/webapp-template status --short`。
   - 读 `AGENTS.md`、`docs/current-source-of-truth.md`、`README.md`、`web/README.md`。
   - 如果任务涉及初始化、默认模块裁剪或模板残留，继续读 `docs/project-init.md`。
   - 如果涉及部署入口或运维可视化，继续读 `docs/deployment-conventions.md` 和相关 deploy docs。

2. 定义页面唯一主任务。
   - 普通用户入口：`/`、`/login`、`/register`，不混入后台管理入口。
   - 管理员入口：`/admin-login`、`/admin-menu`、`/admin-accounts`、`/admin-rbac`，使用 antd admin preset 和独立 admin auth scope。
   - 每个模块、按钮、字段、卡片、表格列、空态、错误态都要回答：谁用它、看完做什么、点击后真实发生什么。

3. 降低密度但不隐藏真源。
   - 删除或降级装饰性、重复、无动作结果、无判断价值的内容。
   - 保留模板该有的工程入口：质量门禁、错误码、健康检查、基础可观测性、鉴权骨架、admin preset 边界。
   - 不把示例业务、模板占位文案、默认部署地址或 live 现场状态当成正式产品信息。
   - 避免营销式大 hero 覆盖实际模板操作入口；模板页更需要清晰导航和可执行命令。

4. 功能细节审查。
   - 登录、注册、管理员登录、未登录重定向、错误提示、加载态、禁用态、空态、长文本和窄屏都要有明确处理。
   - 前端用户可见错误提示走统一 helper，不直接透传英文异常。
   - 账号、角色、权限、后端鉴权和前端菜单显隐要区分：前端隐藏不是安全边界。
   - 改 antd admin preset 时，确认浅色和暗色可读性、表单对齐、按钮状态、表格列宽和移动端退化。

5. 实现策略。
   - 优先复用现有组件、auth scope、request helper、error message helper、CSS 变量和 admin preset。
   - 样式局部收口，不滥用 `!important`。
   - 页面设计变更不要顺手改 schema、migration、部署主路径或后端业务规则。
   - 如果页面设计要求新增或修改 schema、API、RBAC、transaction、error code、server usecase 或持久化语义，停止把它当页面任务，改用 `webapp-template-domain-boundary-governance` 收敛后端边界。
   - 若设计要求需要新业务能力，先停下来说明后端/API/RBAC/文档范围。

6. 回归验证。
   - 样式/布局任务先用真实浏览器或 Playwright 确认 DOM、computed style、box metrics、overflow、相邻区域和响应式状态。
   - 默认执行：
     ```bash
     cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test
     cd /Users/simon/projects/webapp-template/web && pnpm style:l1
     ```
   - `pnpm style:l1` 只覆盖首页、用户登录、注册、管理员登录和未登录访问后台重定向；超出范围要补目标页面回归或说明盲区。
   - 文件改动后按 `AGENTS.md` 更新 `progress.md`，并说明验证状态。

## 交付标准 Deliverable

最终说明：

- 页面主任务、保留/删除/降级的功能细节。
- 哪些模板边界没有改变，尤其 auth scope、admin preset、schema、部署和质量门禁。
- 已验证的默认态、交互态、错误/恢复态、移动端或暗色状态。
- 执行的命令和剩余盲区。
