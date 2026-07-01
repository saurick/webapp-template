---
name: webapp-template-prompt-governance
description: webapp-template 项目提示词治理。Use when Codex writes, refines, evaluates, or converts a webapp-template request into an executable prompt for implementation, review, docs governance, page design, tests, project initialization, deployment, handoff, side chat, main chat, or commit/push work; when a complete copyable final prompt, prompt length control, Codex input limit, engineering quality gate, maintainability, extensibility, simplicity, complexity budget, or prompt boundary conditions are needed; when prompts need template genericity, project-init, health/ready, admin preset, load-test, deploy preflight, README/AGENTS/progress.md boundaries; or when the user wants positive "要做什么" wording instead of broad "不要" lists.
---

# Webapp Template Prompt Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

Use this skill to draft prompts for webapp-template work. Prompts should preserve template genericity: explain the intended reusable template behavior, source docs, allowed paths, validation, and closeout. Use "不要 / 禁止" only for template-breaking or high-risk boundaries.

## Prompt Principle

Write prompts around "要做什么":

- 要修改模板初始化、server、web、migration、deploy、loadtest、docs 或 skills 哪一层。
- 要先读 README、AGENTS、current source of truth、project-init、server/web/scripts docs。
- 要允许改哪些路径。
- 要覆盖哪些 validation commands and checks。
- 要说明这个改动对派生项目的影响。

Use "不要 / 禁止" only for expensive mistakes:

- 不把某个派生项目或业务域硬编码进模板核心。
- 不把 loadtest 当功能正确性测试。
- 不在低配服务器构建；部署任务遵循本地/CI 构建、远端加载制品。
- 不随意改变 template init、project naming、health/ready、migration 或 deploy 主路径。
- 不改 unrelated dirty worktree，不 reset/stash/force push。
- 不把 docs-only/skill-only 改动机械升级成全量运行时测试。

## Complete Prompt Output

当任务是“写 / 改 / 转换提示词”时，必须输出一份完整可复制的 `最终提示词`，用 fenced Markdown 包起来；不要只给原则、片段或检查清单。

如果用户只是问“是否合理 / 为什么 / 怎么处理”，先短答，不强制展开成完整提示词。

长度治理：

- 最终提示词必须能放进目标 Codex / ChatGPT 输入窗口。目标限制未知时，默认压缩历史，保留真源、当前状态、决策、阻塞和验收。
- 如果仍可能超限，输出 `主提示词` + `补充上下文`，不要给一个无法粘贴执行的超长版本。
- 不凭空声称精确 token 余量；需要时只说明压缩和拆分策略。

完整 webapp-template 提示词通常应包含：相关 `$webapp-template-*` skills、目标、先读真源、允许修改、本轮不做、验收、progress.md 要求、对派生项目的影响和收口要求。微型提示词可省略明显无关段落。

## Engineering Quality Gate

webapp-template 提示词必须保护模板的长期可复用性。非平凡任务要把“可维护、可扩展、足够简洁”写成硬约束：

- 优先复用模板现有 init、server/web/deploy/scripts/docs 结构、health/ready 合同和配置命名。
- 新增能力必须是模板级通用能力；不要为了单个派生项目、单个业务域或一次性演示污染模板核心。
- 新增抽象、脚手架参数、migration、deploy step、loadtest、admin preset 或配置层前，必须说明为什么现有模板能力不足，以及对派生项目的影响。
- 如果任务同时牵涉 project-init、runtime、docs、deploy 和 loadtest，先拆成可验证切片。
- 收口必须说明复用点、模板通用性影响、复杂度变化、派生项目迁移风险、未验证项和剩余风险。

## Standard Webapp Template Prompt

```markdown
$webapp-template-prompt-governance
$relevant-webapp-template-skill

目标：
请完成 <one concrete reusable template outcome>.

先读：
- /Users/simon/projects/webapp-template/README.md
- /Users/simon/projects/webapp-template/AGENTS.md
- /Users/simon/projects/webapp-template/docs/current-source-of-truth.md
- /Users/simon/projects/webapp-template/docs/project-init.md
- <task-specific server/web/scripts/deploy docs>

允许修改：
- <exact paths/modules>

本轮不做：
- <only high-risk non-goals: project-specific hardcode, migration, deploy, loadtest, etc.>

工程质量：
- 优先复用 webapp-template 现有 init、server/web/deploy/scripts/docs 结构和 health/ready 合同。
- 新增抽象、参数、migration、deploy step、loadtest 或配置层前，先说明模板级必要性和对派生项目的影响。
- 收口时说明复杂度控制、复用点、模板通用性影响、迁移风险和剩余风险。

验收：
- 先按影响面选择测试形态。
- 执行 <targeted commands / fast/full/strict / style:l1 / preflight as needed>.
- 有正式改动时更新 progress.md。

收口：
- 说明改动文件、验证命令、未覆盖项、对派生项目的影响和剩余风险。
- 如用户要求提交/推送，只提交本轮相关文件，推送前 fetch 并确认不落后远端。
```

## Skill Pairing

| Task | Add these skills |
| --- | --- |
| 文档治理 / docs | `$webapp-template-docs-governance` |
| 页面设计 / 管理端 UI | `$webapp-template-page-design-governance` |
| 代码 review | `$webapp-template-code-review-governance` |
| 测试选择 / 验证范围 | `$webapp-template-test-governance` |
| 通用提示词整理 | `$prompt-governance` |
| 发布/部署/版本 | `$webapp-template-release-governance` |
| 领域边界/实现前评估 | `$webapp-template-domain-boundary-governance` |
| 运行故障诊断 | `$webapp-template-runtime-diagnostics` |
| seed/import/fixture | `$webapp-template-seed-import-governance` |
| 可观测/错误提示 | `$webapp-template-observability-error-governance` |
| 安全/隐私/权限 | `$webapp-template-security-privacy-governance` |

## Prompt Patterns

### Template Init

```markdown
$webapp-template-prompt-governance

目标：
请调整 <project init/template behavior>，保持模板可复用。

先读：
- docs/current-source-of-truth.md
- docs/project-init.md
- README.md

验收：
- 检查项目名、服务名、默认密钥、health/ready、README/docs 口径和初始化脚本影响。
工程质量：
- 保持模板通用，不把派生项目的业务命名或流程写进核心。
```

When asked to produce a prompt, deliver it as:

````markdown
最终提示词：

```markdown
$webapp-template-prompt-governance
...
```
````

### Web / Admin UI

```markdown
$webapp-template-page-design-governance
$webapp-template-prompt-governance

目标：
请修复或优化 <admin/template page>.
要求保留模板通用性，不引入业务专属文案或流程；按影响面运行 web static/unit 和必要 `style:l1`。
```

### Deploy / Load Test

```markdown
$webapp-template-prompt-governance
$webapp-template-test-governance

目标：
请处理 <deploy/loadtest task>.
要求区分功能验证、deploy preflight 和 loadtest；loadtest 只用于性能/容量专项，不替代功能测试。
```

## Common Mistakes

- 把模板改成某个具体业务项目。
- 只写 "参考 plush/trade"，但不说明哪些是通用模板原则、哪些不能照搬。
- 要求 "全量测试" 但不区分 static、unit、style、deploy preflight 和 loadtest。
- 把 docs、runtime、deployment、loadtest 和 project-init 迁移合并成一个过大的提示词。
- 只讲提示词原则但不给最终可复制版本，或把完整聊天历史塞进一个超长 prompt。
- 只要求“功能更强”，但不要求模板通用性、派生项目影响、复杂度预算和迁移风险说明。
