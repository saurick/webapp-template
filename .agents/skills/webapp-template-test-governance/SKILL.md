---
name: webapp-template-test-governance
description: 项目测试治理（webapp-template）。Use when Codex chooses, runs, reviews, or explains validation scope for webapp-template changes, including Go tests, frontend lint/unit/style regression, migrations, project initialization, admin preset, health/ready checks, load-test boundaries, deploy preflight, smoke/full/strict QA scripts, or when the user asks 测试分类/测试治理/怎么测/要不要补测试.
---

# Webapp Template Test Governance

阅读口径：正文默认中文主线 + English anchors；`name` / `display_name` 保持英文，`Workflow / Fact / RBAC / API / migration / runtime` 等术语按需保留，方便触发、检索和跨工具引用。

用这份 skill 把 webapp-template 的测试选择落到模板产品边界：初始化、默认管理端、迁移、健康检查、前端页面、部署脚本和负载测试要区分验证目的。

## Webapp Template 测试质量门禁 Test Quality Gate

测试治理不是跑得越多越好，也不是用一个全量命令替代关键场景。

### 结构质量检查 Structure Quality Checks

- 边界清晰、合理严谨：说明本轮管什么、不管什么、依赖哪个真源，以及为什么当前拆分、抽象和验证足够但不过度。
- 语义清晰：测试名称、fixture、断言和报告必须说明验证的业务语义、合同和证据环境，避免只证明命令跑过。
- 模块化：测试按单元、集成、契约、浏览器回归、发布验证等风险层分工，不用一个大命令掩盖关键断言缺失。
- 高内聚：同一业务规则的样本、fixture、helper 和断言尽量收口，避免不同测试文件维护近似但冲突的口径。
- 低耦合：测试不依赖脆弱顺序、真实外部服务或无关全局状态；需要真实环境时显式声明 target 和证据。
- 单一职责：每个测试说明它证明什么；验证报告区分已覆盖、未覆盖和不适合本轮覆盖的风险。

- 按改动影响面选择最小必要验证组合；docs/skill-only 不机械跑全量，业务真源、RBAC、migration、页面交互或发布链路必须升级验证。
- 测试要覆盖本轮最可能出错的合同、状态、权限、旧数据、边界值、浏览器状态或目标环境；不能只证明 happy path。
- 测试通过不能替代业务边界、字段真源、客户/模板差异、可维护性、可回滚性和文档同步判断。
- 最终必须说明验证层级、测试形态、证据环境、未跑项和剩余盲区，避免“已通过测试”被误读成全系统已验收。

## Workflow

1. 判断改动触达模板初始化、server、web、migration、deploy、loadtest、docs/AGENTS/skill 哪一层。
2. 读取相关真源：`README.md`、`AGENTS.md`、`docs/current-source-of-truth.md`、`docs/project-init.md`、`server/README.md`、`web/README.md`、`scripts/README.md`。
3. 按影响面选择最小充分命令；模板不应因为一次文档改动跑完整负载测试。
4. 部署相关改动按低配边界执行：本地/CI 构建，远端加载制品、migration、启动、健康检查。
5. 汇报命令、结果、未覆盖项；有正式改动时更新 `progress.md`。

## Test Shapes

| 类型 | 适用场景 | 常用命令 / 验证 |
| --- | --- | --- |
| Static / Guard | 任意改动、脚本、配置、skill/docs | `git diff --check`、`bash scripts/qa/shfmt.sh`、`secrets`、skill validator |
| Server Unit / Integration | Go service、auth/admin preset、health/ready、repo/usecase | `cd server && go test ./...`、`make build` |
| Migration / DB | schema、Atlas migration、模板 DB 初始化 | `cd server && make migrate_status`、`make migrate_apply` 前确认目标 DB |
| Frontend Unit / Static | React/admin UI、错误码、组件逻辑 | `cd web && pnpm lint`、`pnpm css`、`pnpm test` |
| Browser Regression | 页面布局、样式、默认态/交互态 | `cd web && pnpm style:l1`，必要时补真实浏览器脚本 |
| Smoke / Full / Strict | 主路径、跨层改动、提交前 | `bash scripts/qa/fast.sh`、`bash scripts/qa/full.sh`、`bash scripts/qa/strict.sh` |
| Deploy Preflight | Compose、runtime env、生产配置 | `bash scripts/qa/production-preflight.sh --runtime`，再做 `/healthz`、`/readyz` |
| Load Test | 性能/容量专项，不是普通功能测试 | `bash scripts/loadtest/run.sh <scenario>`，结果进 `server/deploy/lab-ha/artifacts/loadtest/<run-id>/` |

## Selection Rules

- 模板初始化或项目名替换改动必须检查 `docs/project-init.md`、脚本、README、路径/服务名残留和基础 QA。
- health/ready、部署、Compose 或 migration 改动必须覆盖 server 测试、migration 状态和运行时 preflight。
- 前端样式或布局改动必须跑 `style:l1` 或同等级浏览器回归；`pnpm test` 不替代盒模型/页面回归。
- loadtest 只用于性能/容量专项，不能当成功能正确性测试，也不因普通页面或文档改动机械运行。
- skill/docs-only 改动以 skill/Markdown/引用校验为主，不把模板全量 QA 作为默认成本。

## Reporting Standard

最终回复必须写清：

- 本轮覆盖了 template init、server、web、migration、deploy、loadtest 中哪些层。
- 实际命令与结果。
- 哪些未跑，原因是什么。
- 是否存在未验证的真实浏览器、远端部署、migration 或性能盲区。
