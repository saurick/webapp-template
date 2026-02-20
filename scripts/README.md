# QA 脚本说明

本文档说明本仓库本地质量门禁脚本的用途、执行时机与常见用法。

## 总览

| 脚本 | 主要作用 | 建议时机 |
| --- | --- | --- |
| `scripts/bootstrap.sh` | 初始化依赖、启用 hooks、跑快速自检 | 首次拉仓库后 / 新机器环境 |
| `scripts/qa/db-guard.sh` | 检查 Ent schema/ent 变更是否附带 migration | 改动数据模型后 |
| `scripts/qa/secrets.sh` | 扫描变更文件中的疑似密钥泄露 | 提交前 / 推送前 |
| `scripts/qa/fast.sh` | 快速检查（web lint+css、server 快速测试） | 日常开发高频执行 |
| `scripts/qa/full.sh` | 全量检查（pre-push 默认调用） | 提交前 / 推送前 |
| `scripts/git-hooks/commit-msg.sh` | 校验提交信息规范 | commit-msg hook 自动执行 |

## Hook 对应关系

- `pre-commit` -> `scripts/git-hooks/pre-commit.sh`（增量 prettier + eslint --fix）
- `pre-push` -> `scripts/git-hooks/pre-push.sh` -> `scripts/qa/full.sh`
- `commit-msg` -> `scripts/git-hooks/commit-msg.sh`

## 1) bootstrap

```bash
bash scripts/bootstrap.sh
```

- 默认行为：安装 web/server 依赖 -> 启用 hooks -> 运行 `scripts/qa/fast.sh`
- 常用环境变量：
  - `BOOTSTRAP_SKIP_INSTALL=1`：跳过依赖安装
  - `BOOTSTRAP_SKIP_FAST_QA=1`：跳过快速自检

## 2) db-guard

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

## 3) secrets

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

## 4) fast

```bash
bash scripts/qa/fast.sh
```

- web：`pnpm lint && pnpm css`
- server：优先执行 `go test ./internal/... ./pkg/...`（目录存在才执行）
- 适合在开发中频繁执行，快速发现明显问题。

## 5) full

```bash
bash scripts/qa/full.sh
```

- pre-push 默认执行此脚本
- 执行顺序：
  - `db-guard` -> `secrets`
  - web：`lint -> css -> (可选 test) -> build`
  - server：`go test ./... -> make build`
- 适合在提交前/推送前做最终兜底检查。

## 6) commit-msg

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

## `-h/--help`

上述 6 个脚本均支持 `-h/--help`，可直接在终端查看脚本说明。

示例：

```bash
bash scripts/qa/full.sh --help
```
