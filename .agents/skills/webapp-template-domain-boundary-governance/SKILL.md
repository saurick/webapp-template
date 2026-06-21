---
name: webapp-template-domain-boundary-governance
description: Project-specific domain-boundary implementation governance for webapp-template. Use when Codex implements or reviews webapp-template feature work that may affect data ownership, domain models, workflows, facts, schemas, APIs, permissions, frontend/backend responsibility, customer-specific behavior, source-of-truth fields, stale/missing field values, or cross-module boundaries.
---

# Webapp Template Domain Boundary Governance

Use this skill before implementing webapp-template feature work that may change domain ownership, data truth, APIs, permissions, frontend/backend responsibility, or customer/template-specific behavior.

## Truth Chain

- Read project `AGENTS.md`, `README.md`, current-source docs, and nearest module docs/code/tests for the touched area.
- Treat existing code, schema/migrations, tests, and formal docs as stronger truth than chat plans or old reference notes.

## Project Rules

- 先区分模板自身、派生项目、project-init、server/web/runtime、deploy/lab-ha 和 loadtest。
- 不把某个派生项目名称、域名、密钥、管理员密码或客户流程硬编码进模板核心。
- 模板默认值要可替换、可审计、可初始化验证。

## Workflow

1. State the single domain outcome and the owning layer.
2. Identify source-of-truth fields, states, identifiers, permissions, and derived values.
3. Check whether an existing table/usecase/API/helper already owns the behavior.
4. Cover stale/missing value paths: defaults, edits, source switch/clear, list/detail/print/export/search, and historical fallback when relevant.
5. Keep UI from inventing backend facts and keep customer/template specifics out of generic core.
6. Choose tests by impact: unit/integration/contract/browser/migration as applicable.

## Output

Report ownership decisions, source truth, changed layers, intentionally untouched layers, stale/missing paths, validation, and residual risks.
