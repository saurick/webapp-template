---
name: webapp-template-observability-error-governance
description: webapp-template 项目可观测性与错误治理。Use when Codex designs, reviews, or changes webapp-template structured logs, request IDs, trace IDs, metrics, audit evidence, error codes, error classification, retries, fallbacks, alerts, dashboards, user-facing error messages, or debugging evidence.
---

# Webapp Template 可观测性与错误治理 Observability Error Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 处理 `webapp-template` logs、traces、metrics、audit evidence、error codes、fallbacks、dashboards 和 user-facing errors，让问题能被定位、解释和复现。

## 真源链 Truth Chain

- 先读 error/logging helpers、API contracts、frontend error handling、observability docs 和相关 tests。
- 明确 signal 是给 local debugging、production operations、user support、audit 还是 product metrics 使用。

## 项目规则 Project Rules

- 模板应提供可迁移的 logs/traces/metrics/error helper，不绑定单个部署商或客户域名。
- health/ready、request_id、structured logs 和用户错误提示要在派生项目中仍可理解。
- 错误码/前端提示要区分模板通用层和派生业务层。

## 工作流 Workflow

1. 定义 signal 要回答哪个 operator/user question。
2. 包含稳定 identifiers：request/job/session/domain ids、status、latency、dependency、sanitized classification。
3. 区分 technical logs 和 user-facing messages。
4. fallback/degraded/stale 行为要明确标记原因、时间和证据来源。
5. 用测试、日志样本、浏览器/API evidence 证明 signal 可用。

## 输出 Output

汇报 changed signals、fields、error classifications、user messages、redaction choices、validation 和 remaining observability gaps。
