---
name: webapp-template-docs-governance
description: 项目文档治理（webapp-template）。Use to maintain template current-source, project-init, deployment, README, AGENTS, and progress docs.
---

# Webapp Template 文档治理 Docs Governance

区分维护模板与初始化派生项目；派生业务需求、品牌和凭据不写回通用规则。

## Scope and Truth

- 读取 `AGENTS.md`、`docs/current-source-of-truth.md` 和相关 README / `docs/README.md`；用 `GIT_OPTIONAL_LOCKS=0` 核对 scoped diff，保护外部改动。
- 初始化 / 裁剪看 `docs/project-init.md`；部署看 `docs/deployment-conventions.md` 和对应 server/deploy docs；QA / 脚本看 `scripts/README.md`。只读相关分支，不重复加载未变化内容。
- 当前事实核对代码、脚本、测试和正式 docs；live 现场、历史 patch、模板残留及 progress 不替代模板主路径。
- 用户明确要求长期规则治理时可编辑 AGENTS，普通说明不改政策。必要行为修改转入对应领域流程并继续已有授权；只有实质扩域或未授权动作才暂停。

## Maintain Template Docs

- 保留初始化、auth / admin preset、错误码、health/ready、基础可观测、migration 和 QA 边界，不能因为“像模板”就删。
- 部署说明区分 Compose 主路径、lab-ha、Helm / Kustomize / Argo 与现场 patch；低配目标不承担重构建。
- 结论、读者、范围、主路径与命令前置；比较用表格，步骤用编号，命令用代码块，复杂关系才用 Mermaid，并链接具体文件 / 稳定章节。
- 同一口径只维护一处；普通运行说明进入专题，不堆进 AGENTS。metadata 仅服务真实消费者，不另造索引或审批模板。
- 文档增删 / 改名 / 职责变化时同步 `docs/README.md`、相关 README、锚点与引用；行为、命令、初始化和部署口径变化同步对应专题 / 消费者，纯正文通常不改目录。
- progress 按 AGENTS 触发条件维护；写入前检查 600 行 / 80 KiB，达到后显式归档并保留活跃事项和索引。

## Validate and Deliver

运行 `git diff --check`、定向路径 / 命令 / 术语扫描；Skills 运行 validator 与元数据 / 引用检查；Mermaid 变更检查语法和标签。仅在实际脚本 / 页面合同变化时运行相应测试，不因文档治理执行初始化、migration 或全量 QA。

报告关键修改、AGENTS 是否变更、必要同步、验证和盲区；未触达图表 / metadata 等不逐项汇报。
