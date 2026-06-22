---
name: webapp-template-seed-import-governance
description: webapp-template 项目seed、fixture、导入与清理治理。Use when Codex creates, changes, reviews, or explains webapp-template seed data, fixtures, import scripts, customer data imports, demo data, reversible manual-test data, cleanup scripts, destructive dev resets, source snapshots, or import validation.
---

# Webapp Template Seed / 导入治理 Seed Import Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 处理 `webapp-template` seed data、fixtures、demo data、import dry-runs、manual-test data 和 cleanup，保证数据可查、可回收、不冒充产品真源。

## 真源链 Truth Chain

- 先读 `AGENTS.md`、`docs/current-source-of-truth.md`、`docs/project-init.md`、README、server/web/scripts/deploy docs 和 tests。
- 写数据前确认 target DB/env、schema/migration state、run id/prefix 和 cleanup path。

## 项目规则 Project Rules

- 模板 fixtures、admin preset、project-init 默认数据必须可替换、可重复生成，不保留模板残留。
- import/dry-run 示例只能展示结构和验证路径，不携带真实客户数据或密钥。
- 清理脚本和测试数据要限制在 derived project 或测试环境。

## 工作流 Workflow

1. 定义 purpose：automated test、manual test、demo、import rehearsal、initialization、cleanup。
2. 确认 target environment 和 data source。
3. 复用现有 seed/import scripts；用 stable prefixes/run ids。
4. import 或 destructive cleanup 前先 dry-run。
5. 写入后用 API/page/query/test 证明数据满足目标，并给出 cleanup/rollback。

## 输出 Output

汇报 target env、data source、prefix/run id、dry-run/write result、records affected、cleanup command、validation 和 remaining data risks。
