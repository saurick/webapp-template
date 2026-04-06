# webapp-template 当前真源与 AI 交接顺序

这份文档的目标不是替代代码，而是固定“维护模板本身”和“基于模板初始化新项目”两类任务的阅读顺序，减少新对话里把模板残留、现场 patch、live 机器状态或历史进度误当成正式真源的概率。

## 真源原则

- 当前运行时行为的最终真源始终是代码。
- 涉及“模板应该保留什么、删除什么、替换什么”时，当前正式真源是 `/Users/simon/projects/webapp-template/docs/project-init.md`。
- 涉及部署路径、Compose 与 `lab-ha` 边界、`Helm / Kustomize / Argo CD` 主路径时，当前正式真源是 `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`，以及对应的 `/Users/simon/projects/webapp-template/server/deploy/README.md`。
- 涉及服务端运行、配置、接口、数据库迁移与可观测性时，优先从 `/Users/simon/projects/webapp-template/server/docs/README.md` 继续分流，而不是直接靠印象改某个目录。
- `progress.md`、临时 shell 命令、live 现场操作记录、局部注释和单份 runbook 只能补充演进原因与现场背景，不能越权覆盖这里定义的阅读顺序。

## 按任务分流的阅读顺序

### 1. 维护模板本身

先读：

- `/Users/simon/projects/webapp-template/AGENTS.md`
- `/Users/simon/projects/webapp-template/docs/current-source-of-truth.md`
- `/Users/simon/projects/webapp-template/docs/README.md`
- `/Users/simon/projects/webapp-template/README.md`

再按任务继续：

- 模板初始化、默认模块裁剪、模板残留替换：`/Users/simon/projects/webapp-template/docs/project-init.md`
- 部署边界、Compose / lab-ha / Helm / Kustomize：`/Users/simon/projects/webapp-template/docs/deployment-conventions.md`、`/Users/simon/projects/webapp-template/server/deploy/README.md`
- 服务端运行、配置、接口、DB、可观测性：`/Users/simon/projects/webapp-template/server/docs/README.md`
- 脚本与 QA 入口：`/Users/simon/projects/webapp-template/scripts/README.md`

### 2. 基于模板初始化新项目

先读：

- `/Users/simon/projects/webapp-template/docs/project-init.md`
- `/Users/simon/projects/webapp-template/docs/current-source-of-truth.md`
- `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`
- `/Users/simon/projects/webapp-template/README.md`

再执行：

- `bash scripts/init-project.sh`
- `bash scripts/init-project.sh --project --strict`

说明：

- 初始化任务优先复用 `/Users/simon/projects/webapp-template/docs/project-init.md` 里已经提供的 AI 输入模板。
- 不要把模板默认页面、示例文案、远端地址、live 集群现场状态或历史 patch 当成“应该保留”的默认前提。
- 也不要因为“像模板”就顺手删掉质量门禁、错误码治理、最小健康检查、基础可观测性与通用鉴权骨架。

### 3. 现场部署、排障或真源收口

先读：

- `/Users/simon/projects/webapp-template/docs/deployment-conventions.md`
- `/Users/simon/projects/webapp-template/server/deploy/README.md`
- `/Users/simon/projects/webapp-template/server/docs/README.md`
- `/Users/simon/projects/webapp-template/scripts/README.md`

再决定要不要继续看对应 runbook、脚本或 live 入口文档。

## 新开对话最小交接模板

当你把复杂问题重新交给 AI，至少按下面结构交接，不要只发一段现象：

```text
先读：
- /Users/simon/projects/webapp-template/AGENTS.md
- [本轮必须先读的正式文档]
- [本轮必须先读的代码或 runbook]

任务：
[一句话说明要改什么]

当前唯一真源：
[哪个文件 / 哪段实现 / 哪份文档才是当前真源]

不要碰 / 不要回退到：
[模板残留、旧实现、现场 patch、隐藏锚点、历史 live 状态]

现象：
[问题在哪些状态下复现]

验收：
1. [功能或结构结果]
2. [边界状态]
3. [必须跑的命令]
```

## 什么时候必须显式写清禁区

- 模板里同时存在“当前骨架”和“历史残留”时。
- 同一类部署资源曾同时出现 `Helm / Kustomize / 裸 YAML / 现场 patch` 多条路径时。
- 当前问题以前已经因为 fallback、heuristic 或局部补丁反复改不稳时。
- 任务既涉及“保留模板基线”，又涉及“删除模板残留”时。

## 与其他文档的关系

- `/Users/simon/projects/webapp-template/docs/project-init.md` 负责“如何把模板初始化成新项目”，并已内置适合初始化场景的 AI 输入模板。
- 本文档负责“维护模板本身时先读什么、哪些信息可以当真源、复杂任务怎么交接”。
- 新增根级专题文档后，至少同步更新本文档和 `/Users/simon/projects/webapp-template/docs/README.md`，避免阅读入口再次分散。
