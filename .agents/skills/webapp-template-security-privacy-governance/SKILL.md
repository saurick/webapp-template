---
name: webapp-template-security-privacy-governance
description: webapp-template 项目安全与隐私治理。Use when Codex works on webapp-template authentication, authorization, RBAC, permissions, secrets, credentials, API keys, tokens, production access, customer data, PII, data export, logs containing sensitive data, privacy boundaries, or security-sensitive deployment/configuration changes.
---

# Webapp Template 安全与隐私治理 Security Privacy Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 处理 `webapp-template` authentication、authorization、RBAC、secrets、production access、customer/user data、sensitive logs、exports 和 privacy boundaries。

## 真源链 Truth Chain

- 先读 `AGENTS.md`、`docs/current-source-of-truth.md`、`docs/project-init.md`、README、server/web/scripts/deploy docs 和 tests。
- auth/RBAC docs、deploy/config docs、secret/preflight scripts、touched code/tests 是当前判断依据。

## 项目规则 Project Rules

- 模板默认 secret、admin preset、OAuth/API examples、cert、SealedSecret 和 env 示例不得留下可用凭据。
- 初始化脚本不得生成不可追踪的隐藏管理员入口或把随机密码散落到环境变量。
- 安全规则要可迁移到 derived project，不绑定本机路径或私有 host。

## 工作流 Workflow

1. 识别 assets、actors、permissions、secrets、sensitive data。
2. 确认 backend/API authorization；UI hiding 不是 security boundary。
3. 不记录、不提交、不展示真实 secrets、tokens、PII、customer files、reusable credentials。
4. 高风险操作使用 least privilege、explicit target environment、backup/rollback。
5. 用 tests、secret scan、log redaction check、preflight 或 deployment evidence 验证。

## 输出 Output

汇报 assets、permission boundary、secret/privacy handling、logs/export choices、validation commands 和 residual risks。
