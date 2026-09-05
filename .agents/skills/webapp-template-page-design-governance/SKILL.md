---
name: webapp-template-page-design-governance
description: 项目页面治理（webapp-template）。Use when designing, reviewing, or changing reusable user/admin pages, presets, responsive behavior, accessibility, or browser regression scope.
---

# Webapp Template 页面设计治理 Page Design Governance

从当前任务的 checkout / Worktree 内用 `git rev-parse --show-toplevel` 核对仓库根；下文命令以该根目录为工作目录，仓库内文件引用也相对它解析。

用这个 skill 把 `webapp-template` 的页面做成可复用、低心智负担、容易派生的模板基线。不要把某个派生项目的品牌、业务字段或客户口径写进模板主干。

- 每个元素都要支持明确角色、判断、动作或反馈；无决策价值、重复入口、假快捷方式和装饰性卡片应删除、合并或降级。
- 页面不能补造后端事实、隐藏 API/RBAC/业务边界缺口、显示裸技术字段，或用页面私有映射替代共享 helper / API 合同。
- 降低信息密度必须通过信息分组、任务优先级、可读标签和可验证交互完成，不能隐藏必要状态或吞掉错误。
- 样式、布局和交互要覆盖默认态、交互态、恢复态、长文本/大数字/多标签、暗色/移动端和相邻区域；共享组件按影响面升级验证。

## 工作流 Workflow

1. 先确认页面角色和模板边界。
   - 运行 `GIT_OPTIONAL_LOCKS=0 git status --short`。
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
   - 当前目标需要 schema、API、RBAC、事务或持久化变更时，使用 `webapp-template-domain-boundary-governance` 核对合同，继续授权范围内的实现与验证。
   - 只有新业务能力实质扩大任务范围时才提出具体选择；不依赖该选择的已授权工作继续。

6. 回归验证。
   - 样式/布局任务先用真实浏览器或 Playwright 确认 DOM、computed style、box metrics、overflow、相邻区域和响应式状态。
   - 按 `$webapp-template-test-governance` 从下列入口选择受影响测试和浏览器场景，不把所有命令作为每次必跑组合：
     ```bash
     (cd web && pnpm lint && pnpm css && pnpm test)
     (cd web && pnpm style:l1)
     ```
   - 以 `web/scripts/styleL1.mjs` 当前 scenario list 为覆盖真源；当前还包含 authenticated admin menu、stale-auth recovery、accounts 和 RBAC。目标页面/状态不在清单时补定向回归或说明盲区，不在 skill 中写死总数。
   - 仅在命中 `AGENTS.md` 的过程记录条件时更新 `progress.md`；交付说明实际验证状态。

## 交付标准 Deliverable

最终说明：

- 页面主任务、保留/删除/降级的功能细节。
- 哪些模板边界没有改变，尤其 auth scope、admin preset、schema、部署和质量门禁。
- 已验证的默认态、交互态、错误/恢复态、移动端或暗色状态。
- 执行的命令和剩余盲区。
