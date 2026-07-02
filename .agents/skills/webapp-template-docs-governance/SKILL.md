---
name: webapp-template-docs-governance
description: 项目文档治理（webapp-template）。Use when Codex reviews, creates, renames, reorganizes, simplifies, or updates webapp-template Markdown docs, README files, docs/current-source-of-truth.md, docs/project-init.md, docs/deployment-conventions.md, server/docs, server/deploy docs, scripts docs, progress.md, AGENTS.md docs rules, tables, Mermaid diagrams, reader paths, conclusion-first structure, copyable commands, links, anchors, template initialization docs, deployment docs, or when the user mentions webapp-template with 文档治理, docs, 真源, 模板残留, 初始化, 部署真源, 信息密度, 心智负担, 表格, 流程图, 命令可复制, or 文档漂移.
---

# Webapp Template 文档治理 Docs Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这个 skill 维护 `/Users/simon/projects/webapp-template` 的文档可读性和真源边界。它服务模板本身，不要把派生项目的业务需求写回模板通用规则。

## Webapp Template 文档质量门禁 Docs Quality Gate

文档治理不能只追求写得多或排版整齐。要保护当前真源、降低心智负担、避免文档漂移，并控制文档体系复杂度。

### 结构质量检查 Structure Quality Checks

- 边界清晰、合理严谨：说明本轮管什么、不管什么、依赖哪个真源，以及为什么当前拆分、抽象和验证足够但不过度。
- 语义清晰：标题、术语、表格、图、链接和锚点必须指向明确真源；读者能知道它是什么、适用哪里、下一步去哪。
- 职业任务文案：面向业务、运营、管理或客户阅读的文档，用读者岗位语言说明任务、影响和下一步；工程术语只在开发、诊断、部署、接口或规则文档中使用，并补业务释义。
- 模块化：按读者任务和真源边界组织文档；能在一页讲清就不拆，长文才用索引、摘要表和专题页。
- 高内聚：同一口径、命令、状态、链接和跳转锚点尽量收口到一个真源或索引，不在多处复制近似说明。
- 低耦合：文档引用代码、脚本、页面和正式真源位置，不复写易漂移的实现细节；过程记录不覆盖正式文档。
- 单一职责：README 管导航，专题文档管业务/操作，progress/changelog 管过程；图表和表格只在降低理解成本时使用。

- 先确认代码、migration、测试、README、正式 docs 和 AGENTS 的优先级，不让过程记录覆盖当前真源。
- 结论、适用范围、主路径、验收方式和风险边界前置；表格、Mermaid、链接和摘要只在减少查找成本时使用。
- 行为、入口、配置、测试或部署口径变化时，同步相关索引、README 和 progress；只改措辞时不机械扩大同步面。
- 不为普通说明引入重模板、重复负面清单或并行 metadata；能由现有脚本、索引或文档承接的规则，不再造一套真源。

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
