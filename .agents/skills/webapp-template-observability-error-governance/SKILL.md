---
name: webapp-template-observability-error-governance
description: Project-specific observability and error-governance workflow for webapp-template. Use when Codex designs, reviews, or changes webapp-template structured logs, request IDs, trace IDs, metrics, audit evidence, error codes, error classification, retries, fallbacks, alerts, dashboards, user-facing error messages, or debugging evidence.
---

# Webapp Template Observability Error Governance

Use this skill when webapp-template logs, traces, metrics, audit evidence, error codes, fallbacks, dashboards, or user-facing errors change.

## Truth Chain

- Read project error/logging helpers, API contracts, frontend error handling, observability docs, and tests for touched paths.
- Check whether the signal must support local debugging, production operations, user support, audit, or product metrics.

## Project Rules

- 模板应提供可迁移的 logs/traces/metrics/error helper，不绑定单个部署商或客户域名。
- health/ready、request_id、structured logs 和用户错误提示要在派生项目中仍可理解。
- 错误码/前端提示要区分模板通用层和派生业务层。

## Workflow

1. Define which operator/user question the signal answers.
2. Include stable request/job/session/domain identifiers and sanitized classifications.
3. Separate technical logs from user-facing messages.
4. Mark degraded/stale/fallback behavior honestly.
5. Redact secrets and sensitive customer/user data.
6. Validate at least one success and relevant failure path when feasible.

## Output

Report changed signals, identifiers, redaction, user-facing messages, failure paths checked, and remaining diagnostic gaps.
