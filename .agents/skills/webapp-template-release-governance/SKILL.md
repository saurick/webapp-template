---
name: webapp-template-release-governance
description: Project-specific release, deployment, version, migration, rollback, and release-evidence governance for webapp-template. Use when Codex plans, performs, reviews, or explains webapp-template releases, deploys, version tags, image tags, migrations, release notes, changelog, rollback, production preflight, health checks, post-deploy verification, or target environment delivery.
---

# Webapp Template Release Governance

Use this skill for webapp-template release, deployment, and lightweight version governance. Version management is part of release evidence unless the project later needs a standalone customer-facing release program.

## Truth Chain

- Read project `AGENTS.md`, `README.md`, deployment docs, test strategy, and changed release scripts before action.
- Check worktree and upstream before commit/push/deploy.

## Project Rules

- 模板发布必须保持 derived project 可迁移：本地/CI 构建，低配服务器只 load 镜像、migration、启动和检查。
- `production-preflight.sh`、`server/deploy/README.md` 和 compose prod docs 是发布门禁真源。
- 版本证据绑定模板 commit、派生项目影响、image tag、migration/preflight、health/ready 和回滚点。

## Workflow

1. Define scope: target branch, target host/environment, service/container, migration, config/env, and rollback point.
2. Bind version: commit hash, image/package tag, migration status, config/env version, and release note/changelog need.
3. Run local/CI validation appropriate to changed surfaces before touching a target environment.
4. Build artifacts off low-spec targets unless project docs explicitly allow target-side build.
5. Deploy using the documented path; confirm the target is running the new version from runtime evidence.
6. Check health/ready, logs, smoke/browser/API evidence, migration state, and disk/image cleanup boundaries.
7. Update progress/docs when release behavior, versioning, deployment, config, or operational truth changes.

## Output

Report commit/tag/image, target environment, migration status, commands, health/smoke evidence, rollback point, cleanup, docs/progress updates, and remaining blind spots.
