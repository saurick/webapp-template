---
name: webapp-template-seed-import-governance
description: Project-specific seed, fixture, import, dry-run, demo-data, and cleanup governance for webapp-template. Use when Codex creates, changes, reviews, or explains webapp-template seed data, fixtures, import scripts, customer data imports, demo data, reversible manual-test data, cleanup scripts, destructive dev resets, source snapshots, or import validation.
---

# Webapp Template Seed Import Governance

Use this skill for webapp-template seed data, fixtures, demo data, import dry-runs, manual-test data, and cleanup.

## Truth Chain

- Read project `AGENTS.md`, `README.md`, scripts docs, import/seed docs, and the current DB/env target before data writes.
- Treat real customer/prod data as sensitive and non-default.

## Project Rules

- 模板 fixtures、admin preset、project-init 默认数据必须可替换、可重复生成，不保留模板残留。
- import/dry-run 示例只能展示结构和验证路径，不应携带真实客户数据或密钥。
- 清理脚本和测试数据要限制在派生项目/测试环境。

## Workflow

1. Define purpose: automated test, manual test, demo, import rehearsal, initialization, or cleanup.
2. Confirm target environment and data source.
3. Use stable prefixes/run ids and existing seed/import scripts where available.
4. Run dry-run before real-write when import or destructive cleanup is involved.
5. Provide exact records/routes/expected states and cleanup steps.
6. Update docs/progress when seed/import behavior or manual-test instructions change.

## Output

Report data source, target env, generated prefixes/records, dry-run/real-write result, cleanup path, validation, and remaining risks.
