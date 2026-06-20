---
name: webapp-template-code-review-governance
description: webapp-template 项目代码审查治理。Use when Codex reviews webapp-template code changes in any conversation, including side chats, new main chats, post-implementation reviews, pre-commit reviews, PR-style reviews, current worktree review, staged/unstaged diff review, commit review, or when the user mentions webapp-template with code review, 审查代码, 查 bug, 独立审查, 模板残留, 初始化, admin preset, RBAC, healthz, readyz, observability, deployment, style:l1, or 不要改只看.
---

# Webapp Template 代码审查治理 Code Review Governance

用这个 skill 审查 `/Users/simon/projects/webapp-template` 的代码和正式文档改动。默认只审查，不改代码。

## 范围解析 Scope

1. 用户指定 commit、branch、文件、目录或 PR 时，只审指定范围。
2. side chat 或新会话未指定范围时，审当前仓库 `git status`、staged diff、unstaged diff 和最近相关提交。
3. 当前主会话里“实现后 review”时，审本轮相关改动；若工作区有多组无关改动，先按最近用户请求收窄。
4. 不依赖聊天记忆或实现者解释；以代码、测试、正式文档和当前 diff 为准。

## 必读真源 Truth Chain

先运行：

```bash
git -C /Users/simon/projects/webapp-template status --short
git -C /Users/simon/projects/webapp-template diff --stat
```

再按触达范围读：

- `AGENTS.md`
- `docs/current-source-of-truth.md`
- `README.md`
- `docs/README.md`
- 初始化/模板残留：`docs/project-init.md`
- 部署：`docs/deployment-conventions.md`、`server/deploy/README.md`
- 服务端：`server/README.md`、`server/docs/README.md`、相关 service/biz/data/schema/migration 和测试。
- 前端：`web/README.md`、相关页面、组件、CSS、测试和 `web/scripts`。
- 脚本/QA：`scripts/README.md`。

## 高风险检查 Risk Checklist

重点审这些问题：

- 模板边界：区分维护模板本身和基于模板初始化新项目；不要把派生项目业务需求、live 现场状态或历史 patch 写成模板主路径。
- 初始化：项目名、服务名、镜像名、容器名、页面标题、默认密钥、部署占位符和模板文案要能被 `init-project.sh` 发现或收口。
- 保留通用基线：质量门禁、错误码治理、最小健康检查、基础可观测性、通用鉴权骨架、admin preset 边界不应被误删。
- 前后台入口：普通用户 `/ /login /register` 和管理员 `/admin-login /admin-menu /admin-accounts /admin-rbac` 的 auth scope、文案和导航不能混。
- RBAC / API：前端隐藏不是安全边界；basic RBAC 服务端校验和错误码语义要闭环。
- 错误码：服务端目录、前端生成码表、手写消费层、测试和 docs 必须同步。
- 健康检查：模板默认保留 `/healthz`、`/readyz`、数据库就绪等待和 compose PostgreSQL healthcheck；不要预埋项目特有 Redis/MQ/OSS 依赖。
- 可观测性：新增 HTTP/gRPC/JSON-RPC/任务链路要检查 request_id、trace、结构化日志、成功/失败分支和敏感信息脱敏。
- Migration：Ent + Atlas 变更必须配套 migration；执行前确认命中数据库；发布依赖新 schema 时必须考虑目标环境 migration 状态。
- 部署：Compose、lab-ha、Helm、Kustomize、Argo CD 不能长期并行成多主路径；低配服务器不构建。
- 前端样式：样式改动要看真实浏览器、box metrics、长文本/大数字/移动端；`style:l1` 不是全站覆盖。
- 文档漂移：模板行为、初始化规则、部署路径、runbook、页面文案、接口或配置变化时，同轮检查 README/docs/progress。

## 验证建议 Validation

- 文档/skill-only 改动至少运行 `git diff --check` 和对应 skill validator。
- 前端改动默认考虑：
  ```bash
  cd /Users/simon/projects/webapp-template/web && pnpm lint && pnpm css && pnpm test
  cd /Users/simon/projects/webapp-template/web && pnpm style:l1
  ```
- 后端改动至少考虑：
  ```bash
  cd /Users/simon/projects/webapp-template/server && go test ./...
  ```
- 仓库级改动按影响面考虑 `bash scripts/qa/fast.sh` 或 `bash scripts/qa/full.sh`。
- 初始化相关改动考虑 `bash scripts/init-project.sh` 和 `bash scripts/init-project.sh --project --strict`。

## 输出要求 Output

1. Findings first，按严重度排序，带文件行号、影响和建议。
2. 无问题时明确写“未发现阻塞问题”。
3. 写清审查范围、已读真源、已跑或未跑的验证。
4. 单列剩余盲区，尤其是未跑 `init-project`、未做 `style:l1`、未查 migration/deploy 或未更新 docs/progress 的情况。
