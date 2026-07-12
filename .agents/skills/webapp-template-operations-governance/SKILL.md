---
name: webapp-template-operations-governance
description: 项目运行与发布治理（webapp-template）。Use when Codex diagnoses template or derived-project runtime, init, compose, lab-ha, health or proxy failures; changes reusable observability or error handling; handles template secrets; or plans releases, migrations, preflight, smoke checks, and rollback.
---

# Webapp Template 运行与发布治理 / Operations Governance

## Truth Chain / 必读真源

- 先读 `AGENTS.md`、`docs/current-source-of-truth.md`、`docs/project-init.md`、`docs/deployment-conventions.md`。
- 按任务读取 server/web/scripts/deploy README、preflight、health/ready、compose 或 lab-ha 真源。
- 明确当前是在模板仓库、派生项目、compose prod 还是 lab-ha 环境。

## Project Rules / 项目边界

- 先区分 template、derived project、init output、browser/API、DB/migration、compose、lab-ha、proxy 和 external dependency。
- logs/traces/error helpers 必须可迁移，不绑定单一派生项目、客户、host 或部署商。
- 默认 secrets、admin preset、OAuth/API examples、cert、SealedSecret 和 env 示例不得包含可用凭据。
- 发布必须说明对派生项目的影响，绑定 commit/image、migration/preflight、health/ready、smoke 和 rollback point。
- Compose 与 lab-ha 主路径不混用；低配目标机不承担重构建。

## Workflow / 工作流

1. 明确 diagnose、observe、secure、release 或 rollback，以及 template/derived/environment 边界。
2. 保存版本、init/config、browser/API、DB、container/cluster 和日志证据并脱敏。
3. 最小复现并定位失败层；模板修复必须证明是可复用基线，而非单个派生项目特例。
4. 发布前检查 worktree/upstream、preflight、migration、制品、双 remote 规则和回滚点；Git 收口搭配 `$git-closeout-coordination`。
5. 目标环境验证 health/ready、受影响主路径、日志和派生项目兼容性。
6. 同步 current source、project-init/deployment docs 和 `progress.md`。

## Validation / 验证要求

- 诊断保留最小复现和分层证据；观测性覆盖可迁移字段、错误分类和脱敏。
- 安全运行 secret/preflight 或权限边界检查。
- 发布记录 preflight、migration、health/ready、smoke、派生项目影响、rollback 和未覆盖项。

## Output / 输出要求

汇报失败层或发布结果、模板/派生边界、证据、验证、兼容性影响、回滚点和剩余风险。
