# QA 脚本说明

本文档说明本仓库本地质量门禁脚本的用途、执行时机与常见用法。

## 总览

| 脚本 | 主要作用 | 建议时机 |
| --- | --- | --- |
| `scripts/bootstrap.sh` | 初始化依赖、启用 hooks、跑快速自检 | 首次拉仓库后 / 新机器环境 |
| `scripts/doctor.sh` | 检查本机依赖、hooks 与关键脚本状态 | 新机器初始化 / 异常排查 |
| `scripts/qa/db-guard.sh` | 检查 Ent schema/ent 变更是否附带 migration | 改动数据模型后 |
| `scripts/qa/secrets.sh` | 扫描变更文件中的疑似密钥泄露 | 提交前 / 推送前 |
| `scripts/qa/shellcheck.sh` | 检查 shell 脚本静态问题 | 调整脚本后 |
| `scripts/qa/fast.sh` | 快速检查（web lint+css、server 快速测试） | 日常开发高频执行 |
| `scripts/qa/full.sh` | 全量检查（pre-push 默认调用） | 提交前 / 推送前 |
| `scripts/qa/strict.sh` | 严格检查（warning 视为失败） | 发版前 / 主分支前 |
| `scripts/git-hooks/commit-msg.sh` | 校验提交信息规范 | commit-msg hook 自动执行 |

## Hook 对应关系

- `pre-commit` -> `scripts/git-hooks/pre-commit.sh`（增量 prettier + eslint --fix）
- `pre-push` -> `scripts/git-hooks/pre-push.sh` -> `scripts/qa/shellcheck.sh`（`SHELLCHECK_STRICT=1`）-> `scripts/qa/full.sh`（`SECRETS_STRICT=1`）
- `commit-msg` -> `scripts/git-hooks/commit-msg.sh`

## 1) bootstrap

```bash
bash scripts/bootstrap.sh
```

- 默认行为：安装 web/server 依赖 -> 启用 hooks -> 运行 `scripts/qa/fast.sh`
- 常用环境变量：
  - `BOOTSTRAP_SKIP_INSTALL=1`：跳过依赖安装
  - `BOOTSTRAP_SKIP_FAST_QA=1`：跳过快速自检

## 2) doctor

```bash
bash scripts/doctor.sh
```

- 检查必需依赖：`git`、`node`、`pnpm`、`go`
- 检查可选依赖：`gitleaks`、`shellcheck`
- 检查 `core.hooksPath` 与关键脚本存在性
- 若存在版本文件（`.n-node-version`、`.node-version`、`.nvmrc`），会提示当前 Node 版本是否一致

## 3) db-guard

```bash
bash scripts/qa/db-guard.sh
```

- 当检测到以下变更但没有 migration 文件时，会阻断：
  - `server/internal/data/model/schema/*`
  - `server/internal/data/model/ent/*`
- 需要配套包含：
  - `server/internal/data/model/migrate/*`
- 常用环境变量：
  - `SKIP_DB_GUARD=1`：跳过检查
  - `QA_BASE_RANGE=origin/main...HEAD`：显式指定 diff 范围

## 4) secrets

```bash
bash scripts/qa/secrets.sh
```

- 默认扫描变更文件（工作区 + staged + 可用 upstream diff）
- 依赖：`gitleaks`
- 行为规则：
  - 未安装 `gitleaks`：提示后跳过
  - 命中疑似密钥：默认提示不阻断
  - `SECRETS_STRICT=1`：命中时阻断
- 常用环境变量：
  - `SKIP_SECRETS_SCAN=1`
  - `SECRETS_STRICT=1`
  - `QA_BASE_RANGE=origin/main...HEAD`

## 5) shellcheck

```bash
bash scripts/qa/shellcheck.sh
```

- 使用 `shellcheck` 检查 `scripts/` 与 `.githooks/` 下脚本。
- 常用环境变量：
  - `SKIP_SHELLCHECK=1`
  - `SHELLCHECK_STRICT=1`（未安装 shellcheck 时阻断；pre-push 默认开启）

## 6) fast

```bash
bash scripts/qa/fast.sh
```

- web：`pnpm lint && pnpm css`
- server：优先执行 `go test ./internal/... ./pkg/...`（目录存在才执行）
- 适合在开发中频繁执行，快速发现明显问题。

## 7) full

```bash
bash scripts/qa/full.sh
```

- pre-push 默认以 `SECRETS_STRICT=1` 执行此脚本
- 执行顺序：
  - `db-guard` -> `secrets`
  - web：`lint -> css -> (可选 test) -> build`
  - server：`go test ./... -> make build`
- 适合在提交前/推送前做最终兜底检查。

## 8) strict

```bash
bash scripts/qa/strict.sh
```

- 在 `full` 基础上追加严格规则：
  - `eslint --max-warnings=0`
  - `stylelint --max-warnings=0`
  - 默认运行 `shellcheck`
- 适合发版前或主分支合并前执行。

## 9) commit-msg

```bash
printf "chore(hooks): 校验提交信息\n" > /tmp/commit-msg.txt
bash scripts/git-hooks/commit-msg.sh /tmp/commit-msg.txt
```

- 标题模式：
  - `type(scope): subject`
  - 或 `type: subject`
- 允许类型：
  - `feat|fix|chore|docs|refactor|test|ci|build|perf|style`
- 自动放行：`Merge`、`Revert`、`fixup!`、`squash!`

## 版本锁定

- 根目录 `.n-node-version` 用于约束 Node 版本（`n auto` 会优先读取）。
- 建议执行：`n auto` 后再运行 QA 脚本。

## `-h/--help`

上述脚本均支持 `-h/--help`，可直接在终端查看脚本说明。

示例：

```bash
bash scripts/qa/strict.sh --help
```
