---
name: webapp-template-docs-governance
description: webapp-template 项目文档治理。Use when Codex reviews, creates, renames, reorganizes, simplifies, or updates webapp-template Markdown docs, README files, docs/current-source-of-truth.md, docs/project-init.md, docs/deployment-conventions.md, server/docs, server/deploy docs, scripts docs, progress.md, AGENTS.md docs rules, tables, Mermaid diagrams, reader paths, conclusion-first structure, copyable commands, links, anchors, template initialization docs, deployment docs, or when the user mentions webapp-template with 文档治理, docs, 真源, 模板残留, 初始化, 部署真源, 信息密度, 心智负担, 表格, 流程图, 命令可复制, or 文档漂移.
---

# Webapp Template 文档治理 Docs Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 维护 `/Users/simon/projects/webapp-template` 的文档可读性和真源边界。它服务模板本身，不要把派生项目的业务需求写回模板通用规则。

## 工作流 Workflow

1. Snapshot scope。
   - 运行 `git -C /Users/simon/projects/webapp-template status --short`。
   - 判断任务是 docs-only、docs-adjacent 还是行为变更。
   - 如果触达 runtime、schema、API、部署脚本、页面或 QA 行为，停止把它当纯文档任务。

2. 读文档真源链。
   - 永远先读 `AGENTS.md`，但普通文档治理不默认编辑它。
   - 维护模板本身：读 `docs/current-source-of-truth.md`、`docs/README.md`、`README.md`。
   - 初始化/裁剪：读 `docs/project-init.md`。
   - 部署：读 `docs/deployment-conventions.md`、`server/deploy/README.md`、`server/docs/README.md`。
   - 脚本/QA：读 `scripts/README.md`。
   - `progress.md` 只作过程流水，不作模板当前真源。

3. 保护 `AGENTS.md`。
   - 只有用户明确要求改长期规则、禁止项、必跑流程或仓库级策略时才编辑。
   - 普通 runbook、模板解释、初始化步骤、部署说明优先进入对应 docs/README，而不是堆进 `AGENTS.md`。
   - 最终回复说明 `AGENTS.md` 是只读还是修改。

4. 设计给人读。
   - 开头先给目标、适用范围、当前真源、主路径、验收命令和风险边界。
   - 表格用于短字段、路径矩阵、命令目录、状态比较、风险登记。
   - 编号列表用于初始化、部署、迁移、排障、验证顺序。
   - 代码块用于命令、配置、SQL、API 示例。
   - Mermaid 只在能降低理解成本时使用：真源链、初始化流程、部署路径、Helm/Kustomize/Compose 边界、决策树。
   - 链接尽量指向最具体的稳定章节或文件，不要让读者在多份文档里猜入口。
   - 不为视觉整齐强行表格化长流程或 FAQ。

5. 维护模板边界。
   - 区分“维护模板本身”和“基于模板初始化新项目”。
   - 不把 live 现场状态、历史 patch、模板残留或派生项目需求当成模板主路径。
   - 不因为“像模板”就删除质量门禁、错误码治理、最小健康检查、基础可观测性、通用鉴权骨架。
   - 部署文档必须区分 Compose 主路径、`lab-ha`、Helm、Kustomize、Argo CD 和现场 patch。

6. 同步相关入口。
   - 新增、删除、重命名或改变长期维护文档职责时，检查 `README.md`、`docs/README.md`、附近 README 和正文引用。
   - 行为、命令、部署、配置、页面文案或质量入口变化时，同轮检查相关 README/docs。
   - 文件改动后按 `AGENTS.md` 更新 `progress.md`；写入前检查行数和大小，达到 600 行或 80KB 先归档。

7. 验证。
   - 运行 `git -C /Users/simon/projects/webapp-template diff --check`。
   - 针对旧路径、旧标题、旧命令、旧部署口径、旧模板残留做 `rg` 检查。
   - Mermaid 变更要检查 fenced block、节点标签和周边说明。
   - docs-only 不跑无关 migration 或全量 QA；若文档改变脚本/页面/部署入口，运行对应命令。

## 交付标准 Deliverable

最终说明：

- 读了哪些真源，`AGENTS.md` 是否只读。
- 改了哪些 docs/README/progress，为什么需要或不需要同步索引。
- 是否新增表格、图、链接、命令块，以及它们解决的阅读问题。
- `progress.md` 是否检查了归档阈值。
- 验证命令和剩余盲区。
