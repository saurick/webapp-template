---
name: webapp-template-domain-boundary-governance
description: webapp-template 项目业务边界与数据真源治理。Use when Codex implements or reviews webapp-template feature work that may affect data ownership, domain models, workflows, facts, schemas, APIs, permissions, frontend/backend responsibility, customer-specific behavior, source-of-truth fields, stale/missing field values, or cross-module boundaries.
---

# Webapp Template 业务边界治理 Domain Boundary Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 在实现 `webapp-template` 功能前收敛 domain ownership、source of truth、API/RBAC、frontend/backend responsibility 和 customer/template-specific boundary。

它是模板后端/领域实现主治理入口，覆盖 schema、API、RBAC、transaction、error code、server usecase、repo、migration 和 persisted-data 语义。页面 skill 只负责判断 UI 是否清晰、可用、可回归；如果页面需要后端能力，先回到本 skill 定边界。

## 真源链 Truth Chain

- 先读 `AGENTS.md`、`docs/current-source-of-truth.md`、`docs/project-init.md`、README、server/web/scripts/deploy docs 和 tests。
- 代码、schema/migrations、tests、formal docs 强于聊天规划或旧 reference notes。

## 项目规则 Project Rules

- 先区分模板自身、derived project、project-init、server/web/runtime、deploy/lab-ha 和 loadtest。
- 后端责任要落到 server/API/RBAC/transaction/error-code 真源，不把页面提示、模板占位或 demo 配置当成事实实现。
- 不把某个派生项目名称、域名、密钥、管理员密码或客户流程硬编码进模板核心。
- 模板默认值要可替换、可审计、可初始化验证。

## 工作流 Workflow

1. 写出 single domain outcome 和 owning layer。
2. 找到 source-of-truth fields、states、identifiers、permissions、derived values。
3. 检查现有 table/usecase/API/helper 是否已经拥有该行为。
4. 覆盖 stale/missing value paths：defaults、edits、source switch/clear、list/detail/print/export/search、historical fallback。
5. UI 不补造 backend facts；客户/模板特例不污染 generic core。
6. 按影响面选择 unit、integration、contract、browser、migration validation。

## 输出 Output

汇报 ownership decisions、source truth、changed layers、intentionally untouched layers、stale/missing paths、validation 和 residual risks。
