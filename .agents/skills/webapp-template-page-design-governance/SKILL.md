---
name: webapp-template-page-design-governance
description: webapp-template 项目页面设计治理。Use when Codex designs, reviews, simplifies, or implements webapp-template pages, frontend UI, landing/home pages, user login/register pages, admin-login, admin-menu, admin-accounts, admin-rbac, antd admin preset pages, forms, tables, cards, filters, empty/error/loading states, responsive layout, dark/light readability, page feature semantics, browser style regression, prototypes or screenshots, or when the user mentions webapp-template with 页面设计, 简洁易用, 美观, 心智负担, 信息密度, 一眼看不懂, 功能细节, 页面好看, 样式回归, style:l1, or 低密度.
---

# Webapp Template 页面设计治理 Page Design Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 把 `webapp-template` 的页面做成可复用、低心智负担、容易派生的模板基线。不要把某个派生项目的品牌、业务字段或客户口径写进模板主干。

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
