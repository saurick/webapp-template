# QA 脚本说明

本文档说明本仓库本地质量门禁脚本的用途、执行时机与常见用法。

## 总览

| 脚本 | 主要作用 | 建议时机 |
| --- | --- | --- |
| `scripts/bootstrap.sh` | 初始化依赖、启用 hooks、跑快速自检 | 首次拉仓库后 / 新机器环境 |
| `scripts/init-project.sh` | 扫描模板残留、默认配置和模块裁剪点 | 新项目由模板初始化后 |
| `scripts/doctor.sh` | 检查本机依赖、hooks 与关键脚本状态 | 新机器初始化 / 异常排查 |
| `scripts/qa/db-guard.sh` | 检查 Ent schema/ent 变更是否附带 migration | 改动数据模型后 |
| `scripts/qa/secrets.sh` | 扫描变更文件中的疑似密钥泄露 | 提交前 / 推送前 |
| `scripts/qa/shellcheck.sh` | 检查 shell 脚本静态问题 | 调整脚本后 |
| `scripts/qa/go-vet.sh` | 执行 Go vet 静态检查 | 改动 Go 代码后 |
| `scripts/qa/golangci-lint.sh` | 执行 golangci-lint（默认仅新增问题） | 改动 Go 代码后 |
| `scripts/qa/yamllint.sh` | 检查 YAML 语法与风格（基线降噪） | 改动 YAML 后 |
| `scripts/qa/shfmt.sh` | 统一 shell 脚本格式 | 调整脚本后 |
| `scripts/qa/govulncheck.sh` | 扫描 Go 依赖与代码可达漏洞 | 推送前 / 发版前 |
| `scripts/qa/error-code-sync.sh` | 校验前端生成错误码是否与后端目录同步 | 新增/修改错误码后 |
| `scripts/qa/error-codes.sh` | 检查业务代码是否裸写已注册错误码 | 改动接口/鉴权/前端错误处理后 |
| `scripts/qa/fast.sh` | 快速检查（web lint+css、server 快速测试） | 日常开发高频执行 |
| `scripts/qa/full.sh` | 全量检查（pre-push 默认调用） | 提交前 / 推送前 |
| `scripts/qa/strict.sh` | 严格检查（warning 视为失败） | 发版前 / 主分支前 |
| `scripts/loadtest/run.sh` | 运行最小 `k6` 压测场景 | 需要验证健康检查 / JSON-RPC / 登录链路时 |
| `scripts/git-hooks/commit-msg.sh` | 校验提交信息规范 | commit-msg hook 自动执行 |

补充说明：前端浏览器级样式回归入口不在 `scripts/qa` 下，而是 `cd /Users/simon/projects/webapp-template/web && pnpm style:l1`。它负责验证首页、用户登录、注册、管理员登录和未登录访问后台时的重定向这些高频视觉场景。

## Hook 对应关系

- `pre-commit` -> `scripts/git-hooks/pre-commit.sh`
  - 增量 `prettier + eslint --fix + shfmt`
  - `shellcheck + error-code-sync + error-codes + gitleaks`
  - Go 变更时执行 `go vet + golangci-lint`（仅改动包 + 仅新增问题）
  - YAML 变更时执行 `yamllint`（仅暂存 YAML + .yamllint 降噪规则）
- `pre-push` -> `scripts/git-hooks/pre-push.sh` -> `scripts/qa/shellcheck.sh`（`SHELLCHECK_STRICT=1`）-> `scripts/qa/full.sh`（`SECRETS_STRICT=1`）
- `commit-msg` -> `scripts/git-hooks/commit-msg.sh`

## 1) bootstrap

```bash
bash scripts/bootstrap.sh
```

- 默认行为：安装 web/server 依赖 -> 启用 hooks -> 运行 `scripts/qa/fast.sh`
- 脚本结束后会提示：若当前仓库是由模板初始化的新项目，继续执行 `scripts/init-project.sh`
- 常用环境变量：
  - `BOOTSTRAP_SKIP_INSTALL=1`：跳过依赖安装
  - `BOOTSTRAP_SKIP_FAST_QA=1`：跳过快速自检

## 2) init-project

```bash
bash scripts/init-project.sh
```

- 用于扫描“由模板初始化后的新项目”仍需处理的内容：
  - 项目名 / 服务名 / 页面标题
  - 默认密码 / JWT 密钥 / 数据库名
  - 远端主机 / 镜像仓库 / 部署目录 / base path
  - K8s / Jaeger / 远端发布脚本 / 后台业务骨架等按需裁剪点
- 常用参数：
  - `--project`：按派生项目模式执行
  - `--template-source`：按模板源仓库模式执行
  - `--strict`：派生项目模式下，命中必须处理项时返回非 0
- 推荐二次校验：
  - `bash scripts/init-project.sh --project --strict`

## 3) doctor

```bash
bash scripts/doctor.sh
```

- 检查必需依赖：`git`、`node`、`pnpm`、`go`
- 检查可选依赖：`gitleaks`、`shellcheck`、`golangci-lint`、`yamllint`、`shfmt`、`govulncheck`
- 检查 `core.hooksPath` 与关键脚本存在性
- 若存在版本文件（`.n-node-version`、`.node-version`、`.nvmrc`），会提示当前 Node 版本是否一致

## 4) db-guard

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
  - `QA_BASE_RANGE=origin/master...HEAD`：显式指定 diff 范围

## 5) secrets

```bash
bash scripts/qa/secrets.sh
```

- 默认扫描变更文件（工作区 + staged + 可用 upstream diff）
- 依赖：`gitleaks`
- 行为规则：
  - 未安装 `gitleaks`：默认提示后跳过，`SECRETS_STRICT=1` 时阻断
  - 命中疑似密钥：默认提示不阻断，`SECRETS_STRICT=1` 时阻断
- 常用环境变量：
  - `SKIP_SECRETS_SCAN=1`
  - `SECRETS_STRICT=1`
  - `SECRETS_STAGED_ONLY=1`（仅扫描 staged 内容）
  - `QA_BASE_RANGE=origin/master...HEAD`

## 6) shellcheck

```bash
bash scripts/qa/shellcheck.sh
```

- 使用 `shellcheck` 检查 `scripts/` 与 `.githooks/` 下脚本。
- 常用环境变量：
  - `SKIP_SHELLCHECK=1`
  - `SHELLCHECK_STRICT=1`（未安装 shellcheck 时阻断；pre-push 默认开启）

## 7) go-vet

```bash
bash scripts/qa/go-vet.sh
```

- 在 `server` 目录执行 `go vet`（默认 `./...`，可传包参数）。
- 常用环境变量：
  - `SKIP_GO_VET=1`

## 8) golangci-lint

```bash
bash scripts/qa/golangci-lint.sh
```

- 在 `server` 目录执行 `golangci-lint run`。
- 默认仅拦截“相对 `HEAD` 的新增问题”，降低历史基线噪音。
- 常用环境变量：
  - `SKIP_GOLANGCI_LINT=1`
  - `GOLANGCI_STRICT=1`（未安装 golangci-lint 时阻断）
  - `GOLANGCI_ONLY_NEW=1`（默认）

## 9) yamllint

```bash
bash scripts/qa/yamllint.sh
```

- 检查 YAML 语法与风格（默认仅检查变更 YAML，`YAMLLINT_ALL=1` 才全量扫描）。
- 默认读取根目录 `.yamllint` 规则，排除锁文件与生成目录，降低历史基线噪声。
- 常用环境变量：
  - `SKIP_YAMLLINT=1`
  - `YAMLLINT_STRICT=1`（未安装 yamllint 时阻断）
  - `YAMLLINT_ALL=1`（全量扫描仓库 YAML）

## 10) shfmt

```bash
bash scripts/qa/shfmt.sh
```

- 格式化 `scripts/` 与 `.githooks/` 下 shell 脚本。
- 常用环境变量：
  - `SKIP_SHFMT=1`
  - `SHFMT_STRICT=1`（未安装 shfmt 时阻断）
  - `SHFMT_CHECK=1`（仅检查格式，不改写文件）

## 11) govulncheck

```bash
bash scripts/qa/govulncheck.sh
```

- 在 `server` 目录执行 `govulncheck`（默认 `./...`）。
- 默认跟随 `server/go.mod` 中声明的 `toolchain` 扫描，减少本机 Go 版本漂移导致的标准库误报；如需覆盖可自行设置 `GOTOOLCHAIN`。
- 常用环境变量：
  - `SKIP_GOVULNCHECK=1`
  - `GOVULNCHECK_STRICT=1`（非 0 退出码时阻断）
  - `GOTOOLCHAIN=<value>`

## 12) error-code-sync

```bash
bash scripts/qa/error-code-sync.sh
```

- 使用 `scripts/gen-error-codes.mjs --check` 校验 `web/src/common/consts/errorCodes.generated.js` 是否已和 `server/internal/errcode/catalog.go` 同步。
- 常用环境变量：
  - `SKIP_ERROR_CODE_SYNC=1`

## 13) error-codes

```bash
bash scripts/qa/error-codes.sh
```

- 从 `server/internal/errcode/catalog.go` 提取已注册错误码，阻止在业务代码里直接裸写这些数字。
- 默认检查 `server/` 与 `web/src/` 下业务代码；测试、文档、错误码目录、生成文件默认跳过。
- 常用环境变量：
  - `SKIP_ERROR_CODE_GUARD=1`
  - `ERROR_CODE_GUARD_STAGED_ONLY=1`（pre-commit 默认使用）

## 14) fast

```bash
bash scripts/qa/fast.sh
```

- `error-code-sync`：前端生成错误码同步检查
- `error-codes`：统一错误码魔法数字检查
- web：`pnpm lint && pnpm css`
- server：优先执行 `go test ./internal/... ./pkg/...`（目录存在才执行）
- 适合在开发中频繁执行，快速发现明显问题；它更接近“粗粒度冒烟/快速检查”，不替代前端浏览器级样式回归。
- 前端样式/布局任务至少应额外执行 `cd /Users/simon/projects/webapp-template/web && pnpm style:l1`。

## 15) full

```bash
bash scripts/qa/full.sh
```

- pre-push 默认以 `SECRETS_STRICT=1` 执行此脚本
- 若定义了前端 `test`，会在 `full` 中一并执行，但它仍然属于仓库级 QA 全量检查，不替代样式/布局任务的浏览器级回归。

## 16) loadtest

```bash
bash scripts/loadtest/run.sh mixed
```

- 提供最小 `k6` 压测能力，覆盖 `health`、`system`、`auth`、`mixed` 四类场景。
- 默认结果落到 `server/deploy/lab-ha/artifacts/loadtest/<run-id>/`。
- 详细用法见 `/Users/simon/projects/webapp-template/scripts/loadtest/README.md` 与 `/Users/simon/projects/webapp-template/server/deploy/lab-ha/docs/LOAD_TEST.md`。
- 执行顺序：
  - `db-guard` -> `error-code-sync` -> `error-codes` -> `secrets` -> `govulncheck`（默认提示模式）
  - web：`lint -> css -> (若定义 test 则执行) -> build`
  - server：`go test ./... -> make build`
- 适合在提交前/推送前做最终兜底检查。
- 若本轮确实触达前端样式链路，应在 `full` 之外补跑 `cd /Users/simon/projects/webapp-template/web && pnpm style:l1`，因为 `full` 不会自动打开浏览器验证 box 模型与重定向页面。

## 16) strict

```bash
bash scripts/qa/strict.sh
```

- 在 `full` 基础上追加严格规则：
  - `eslint --max-warnings=0`
  - `stylelint --max-warnings=0`
  - 默认运行 `shellcheck + shfmt(check) + govulncheck(strict)`
- 适合发版前或主分支合并前执行。

## 17) commit-msg

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
