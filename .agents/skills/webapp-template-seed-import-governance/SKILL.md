---
name: webapp-template-seed-import-governance
description: 项目seed、fixture、导入与清理治理（webapp-template）。Use when Codex creates, changes, reviews, or explains webapp-template seed data, fixtures, import scripts, customer data imports, demo data, reversible manual-test data, cleanup scripts, destructive dev resets, source snapshots, or import validation.
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

## 结构质量门禁 Structure Quality Gate

- 边界清晰、合理严谨：说明本轮管什么、不管什么、依赖哪个真源，以及为什么当前拆分、抽象和验证足够但不过度。
- 模块化：seed、fixture、dry-run、真实 import、cleanup 和 rollback 分开入口，不用一个脚本同时承担模拟、写入和清理所有职责。
- 高内聚：同一数据来源、run id/prefix、映射规则、去重规则和清理规则收口到共享配置或 helper。
- 低耦合：测试数据不污染产品真源，demo 数据不伪装成客户事实，导入脚本不绕过 schema/usecase/RBAC/audit 主路径。
- 单一职责：每批数据都说明 purpose、target env、write scope、cleanup path 和未覆盖风险；不可回收数据默认不写。

## 工作流 Workflow

1. 定义 purpose：automated test、manual test、demo、import rehearsal、initialization、cleanup。
2. 确认 target environment 和 data source。
3. 复用现有 seed/import scripts；用 stable prefixes/run ids。
4. import 或 destructive cleanup 前先 dry-run。
5. 写入后用 API/page/query/test 证明数据满足目标，并给出 cleanup/rollback。

## 输出 Output

汇报 target env、data source、prefix/run id、dry-run/write result、records affected、cleanup command、validation 和 remaining data risks。
