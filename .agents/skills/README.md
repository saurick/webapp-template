# Codex 项目 Skills / Project Skills

本目录只保存 webapp-template 的专项 SOP。长期规则在 `AGENTS.md`，模板事实在 current source、project-init、deployment docs、代码和测试；通用工作流使用 `~/.codex/skills`。

| Skill | 适用范围 |
| --- | --- |
| `$webapp-template-code-review-governance` | review 模板残留、初始化、admin preset、health/ready 和部署改动 |
| `$webapp-template-docs-governance` | current source、project-init、deployment conventions 和读者路径 |
| `$webapp-template-domain-boundary-governance` | template/derived project、init、schema/API/RBAC、default data 和字段真源 |
| `$webapp-template-page-design-governance` | 通用页面、admin preset、响应式和 L1 回归 |
| `$webapp-template-test-governance` | server/web/migration、init、health/ready、style、loadtest 和 preflight |
| `$webapp-template-operations-governance` | 模板/派生运行诊断、可迁移观测、安全、发布和回滚 |

## 选择规则

从当前任务的 checkout / Worktree 内用 `git rev-parse --show-toplevel` 核对仓库根；下文命令以该根目录为工作目录，仓库内文件引用也相对它解析。

只执行当前目标相关的分支，切换 Skill 后继续已授权工作；入口和元数据保持一致，未变化的内容不重复加载。

- 简单任务只选一个主 skill；模板与派生项目、页面与后端、运行与发布跨界时再组合。
- 提示词整理使用全局显式 `$prompt-governance`；当前任务已授权 commit / push 且现场复杂时使用 `$git-closeout-coordination`。
- fixture/admin preset/default data 规则由 domain + test 承接，不再单独维护 seed skill。
- 项目 skill 只保留模板真源、判断流程、命令和验收；修改后运行 validator、`node scripts/qa/skill-health.mjs` 与 `git diff --check`，仅在命中 `AGENTS.md` 的过程记录条件时更新 `progress.md`。
