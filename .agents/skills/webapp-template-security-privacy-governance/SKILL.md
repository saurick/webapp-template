---
name: webapp-template-security-privacy-governance
description: Project-specific security and privacy governance for webapp-template. Use when Codex works on webapp-template authentication, authorization, RBAC, permissions, secrets, credentials, API keys, tokens, production access, customer data, PII, data export, logs containing sensitive data, privacy boundaries, or security-sensitive deployment/configuration changes.
---

# Webapp Template Security Privacy Governance

Use this skill when webapp-template changes touch authentication, authorization, secrets, credentials, production access, customer/user data, sensitive logs, exports, or privacy boundaries.

## Truth Chain

- Read project `AGENTS.md`, auth/RBAC docs, deploy/config docs, secret/preflight scripts, and touched code/tests.
- Treat production/test envs, tokens, credentials, customer data, logs, screenshots, and exports as sensitive by default.

## Project Rules

- 模板默认 secret、admin preset、OAuth/API examples、cert、SealedSecret 和 env 示例不得留下可用凭据。
- 初始化脚本不得生成不可追踪的隐藏管理员入口或把随机密码散落到环境变量。
- 安全规则要可迁移到派生项目，不绑定本机路径或私有 host。

## Workflow

1. Identify assets, actors, permissions, secrets, and sensitive data involved.
2. Confirm backend/API authorization; UI hiding is not a security boundary.
3. Avoid logging/committing/exposing real secrets, tokens, PII, customer files, or reusable credentials.
4. Use least privilege and explicit target environment for risky operations.
5. Validate unauthorized/disabled/no-permission/wrong-role/secret-placeholder/data-leak paths as relevant.
6. Update docs/progress when security, privacy, deploy, or permission behavior changes.

## Output

Report assets touched, permission model, secret/privacy handling, checks run, residual risk, and any rotation or follow-up needed.
