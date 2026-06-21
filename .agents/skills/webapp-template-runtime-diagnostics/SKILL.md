---
name: webapp-template-runtime-diagnostics
description: Project-specific runtime diagnostics workflow for webapp-template. Use when Codex diagnoses webapp-template page errors, API/RPC failures, backend read/write failures, migration drift, database mismatch, deployment mismatch, browser/runtime issues, logs, request IDs, configuration drift, environment confusion, or production/test/local differences before changing code.
---

# Webapp Template Runtime Diagnostics

Use this skill to diagnose webapp-template runtime failures from evidence before editing code.

## Truth Chain

- Check actual environment, branch/commit/image, config/env, DB/migration state, logs, request IDs, browser network/console, and recent deploys.
- Do not infer runtime truth from static code alone when live behavior is available.

## Project Rules

- 诊断时区分模板 repo 运行、派生项目运行、init 输出、compose prod、lab-ha 和 loadtest 环境。
- health/ready、admin preset、migration、asset/build 和 reverse proxy 要分层核对。
- 不把 loadtest 失败当成功能失败，除非证据显示功能链路本身异常。

## Workflow

1. Capture exact symptom, route/API, user/role, timestamp, environment, and last known good version.
2. Classify the failing layer: browser/UI, route/menu, API/RPC, service/usecase, DB/migration, auth/RBAC, config/env, deploy/container, network/upstream.
3. Reproduce narrowly with one command/request/browser action.
4. Compare runtime evidence against code/docs; distinguish local/test/prod and mock/real paths.
5. Fix the owning layer, avoiding page-local or fallback patches unless they are documented and bounded.
6. Rerun the failing path and adjacent regression checks.

## Output

Report root cause, evidence, environment, commands/requests, fix scope, validation, and unverified paths.
