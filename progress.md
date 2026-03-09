## 2026-03-09
- 完成：精简并重写 `/Users/simon/projects/webapp-template/AGENTS.md` 的错误码约定，把模板仓库默认采用的“服务端真源 -> 构建期生成 `errorCodes.generated.js` -> 手写 `errorCodes.js` 消费层 wrapper”模式固化下来，明确生成文件禁止手改、前端业务代码优先走 wrapper、错误码变更必须跑同步守卫。
- 完成：同步把通用错误码治理模式沉淀到全局 `/Users/simon/.codex/AGENTS.md`，并把模板层约束收口为“只保留通用鉴权分组与默认文案，项目特例下沉到派生仓库”，避免把某个项目的特殊语义反写回模板。
- 验证：已人工复核全局 AGENTS 与模板项目 AGENTS 的职责边界、路径命名和当前仓库实现一致；本次仅为协作规则更新，未改动运行时代码。
- 下一步：后续基于模板派生新项目时，默认沿用这套分层模式，再仅在派生仓库补项目特例和码位语义。
- 阻塞/风险：无。

## 2026-03-09
- 完成：将模板仓库的错误码治理升级为“服务端目录真源 + 构建期生成前端码表”的默认模式：继续以 `/Users/simon/projects/webapp-template/server/internal/errcode/catalog.go` 为唯一真源，新增 `/Users/simon/projects/webapp-template/scripts/gen-error-codes.mjs` 生成 `/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.generated.js`，并把 `/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js` 收口为消费层薄封装，便于后续新项目直接继承。
- 完成：新增 `/Users/simon/projects/webapp-template/scripts/qa/error-code-sync.sh`，并把错误码生成/同步校验接入 `/Users/simon/projects/webapp-template/web/package.json` 的 `prebuild`、`pretest`，以及 `/Users/simon/projects/webapp-template/scripts/git-hooks/pre-commit.sh`、`/Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`/Users/simon/projects/webapp-template/scripts/qa/full.sh`，让模板默认具备“前后端错误码漏同步即阻断”的基线能力。
- 完成：同步更新 `/Users/simon/projects/webapp-template/README.md` 与 `/Users/simon/projects/webapp-template/scripts/README.md` 的错误码治理文档，并补齐 `/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.test.mjs`，确保模板项目开箱即带错误码唯一性与登录态分类回归。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/qa/error-code-sync.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/errcode ./internal/data`、`cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --no-warn-ignored src/common/consts/errorCodes.js src/common/consts/errorCodes.generated.js src/common/consts/errorCodes.test.mjs`、`cd /Users/simon/projects/webapp-template/web && pnpm test`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/shfmt.sh scripts/git-hooks/pre-commit.sh scripts/qa/fast.sh scripts/qa/full.sh scripts/qa/error-code-sync.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/shellcheck.sh`。
- 下一步：后续基于模板新建项目时，可直接沿用这套“catalog.go 真源 + generated 前端码表 + QA/CI 同步校验”的默认骨架，再按项目特例补消费层函数和文案。
- 阻塞/风险：`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh` 当前已通过，`govulncheck` 显示代码可达漏洞为 0，但仍提示依赖模块中有 5 个“当前未调用”的漏洞记录；模板层本次未改动相关依赖，后续仍建议单独安排 Go/依赖升级回归。

## 2026-03-08
- 完成：把 `webapp-template` 的错误码治理收口成更适合作为模板复用的通用骨架：保留现有统一错误码目录与前端常量来源不变，并继续把“仅登录态失效才触发重新登录”的语义固定下来。
- 完成：增强 `scripts/qa/error-codes.sh`，补上仓库内绝对路径入参兼容、`.mjs` 文件支持，以及“仅在错误码语境下匹配”的规则，避免后续模板派生项目把金额、配置值等普通数字误判为错误码。
- 完成：新增模板级最小回归测试：服务端补 `server/internal/data/jsonrpc_error_mapping_test.go`，锁定 `auth.me` 未登录与 `ErrNoPermission` 的错误码映射；前端补 `web/src/common/consts/errorCodes.test.mjs` 并在 `web/package.json` 新增 `pnpm test`，锁定错误码唯一性、登录态失效分类与默认提示文案。
- 完成：同步更新 `README.md` 与 `scripts/README.md`，把模板当前已自带前端最小测试与错误码守卫说明写回文档，减少后续派生仓库遗漏。
- 验证：已通过 `bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh /Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go /Users/simon/projects/webapp-template/web/src/common/utils/jsonRpc.js /Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.js /Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js /Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.test.mjs`、`cd /Users/simon/projects/webapp-template/server && go test ./internal/errcode ./internal/data`、`cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --no-warn-ignored src/common/consts/errorCodes.js src/common/consts/errorCodes.test.mjs src/common/utils/jsonRpc.js src/common/utils/errorMessage.js`、`cd /Users/simon/projects/webapp-template/web && pnpm test`、`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`。
- 下一步：后续若再派生新服务项目，建议直接复制 `server/internal/errcode/`、`web/src/common/consts/errorCodes.js`、`web/src/common/consts/errorCodes.test.mjs` 与 `scripts/qa/error-codes.sh`，再按项目语义分配具体码位。
- 阻塞/风险：`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh` 期间 `govulncheck` 仍提示本机 Go `1.26.0` 标准库漏洞（修复版本为 `1.26.1`）；当前模板门禁仍为提示模式未阻断，本次未改动相关调用链，后续若要把模板基线也收口为全绿，仍需单独升级本地/CI Go 工具链。

## 2026-03-07
- 完成：将根目录 `.n-node-version` 从 `24.11.1` 升级到 `24.14.0`，统一项目本地 Node 版本锁定。
- 完成：将 `server/Dockerfile` 与 `web/Dockerfile` 的前端构建基础镜像同步钉住到 `node:24.14.0`，避免容器与本地环境漂移。
- 验证：已复核仓库内 Node 版本声明位置；当前显式版本已与 `v24.14.0` 对齐。
- 下一步：本地执行 `n auto` 或手动切换到 `v24.14.0` 后，再运行 `bash scripts/doctor.sh` / 前端构建检查环境一致性。
- 阻塞/风险：若本机或 CI 仍使用旧版 Node 24.x，`doctor` 会继续提示版本不一致，需要同步升级运行环境。

## 2026-03-07
- 完成：在项目级 `/Users/simon/projects/webapp-template/AGENTS.md` 新增“服务端可观测性约束”，把 `trace/log`、统一包装、panic 兜底、结构化日志、观测性测试与最终交付说明要求固化到模板仓库规则中，便于后续新项目继承。
- 验证：本次为协作约定补充，已人工复核条目与仓库当前 Go 服务端模板实践一致，未涉及运行时代码行为变更。
- 下一步：后续基于模板派生的新项目默认沿用这套约束；如需更严格，可再补一条“新增自定义路由必须附观测性测试”的 review 清单。
- 阻塞/风险：无。

## 2026-02-20
- 完成：落地最小侵入基线策略：`pre-commit` 的 Go 检查改为“仅改动包 + `golangci-lint` 仅新增问题（`--new-from-rev HEAD`）”；YAML 检查改为“默认仅变更文件，`YAMLLINT_ALL=1` 才全量”。
- 完成：新增并启用根目录 `.yamllint`（降噪规则 + 忽略锁文件/生成目录），并同步更新 `scripts/README.md` 与根 `README.md` 的门禁说明。
- 验证：三仓库执行 `go-vet`、`golangci-lint`、`yamllint` 与 `scripts/git-hooks/pre-commit.sh` 均通过，`doctor` 显示依赖与脚本检查全部通过。
- 下一步：若要治理历史存量问题，可在不影响当前门禁的前提下分批执行 `YAMLLINT_ALL=1` 与 `GOLANGCI_ONLY_NEW=0` 清理。
- 阻塞/风险：无。

## 2026-02-20
- 完成：接入 pre-commit 五项门禁（`gitleaks`、`shellcheck`、`go vet`、`golangci-lint`、`yamllint`），并按“增量优先”策略实现（Web 仅暂存文件、Go 仅有 Go 变更触发、YAML 仅暂存 YAML 触发）。
- 完成：新增 `scripts/qa/go-vet.sh`、`scripts/qa/golangci-lint.sh`、`scripts/qa/yamllint.sh`，并同步更新 `scripts/git-hooks/pre-commit.sh`、`scripts/qa/secrets.sh`、`scripts/doctor.sh`、`scripts/setup-git-hooks.sh` 与 README 文档。
- 验证：三个仓库均执行新增脚本；`go-vet` 通过，`golangci-lint` 与 `yamllint` 在现有历史代码/配置基线上报出问题（符合预期，未做历史问题清理）。
- 下一步：如需让 pre-commit 在现状下可顺畅通过，需要先清理历史 `golangci-lint`/`yamllint` 存量问题或按仓库基线配置忽略策略。
- 阻塞/风险：当前若提交涉及 Go/YAML 改动，pre-commit 可能被历史问题阻断。

## 2026-02-20
- 完成：将 `scripts/git-hooks/pre-push.sh` 调整为更严格模式：先执行 `scripts/qa/shellcheck.sh`（`SHELLCHECK_STRICT=1`）再执行 `scripts/qa/full.sh`（`SECRETS_STRICT=1`）。
- 完成：同步更新 `README.md` 与 `scripts/README.md` 的 pre-push 说明，确保文档与实际门禁策略一致。
- 验证：执行 `bash scripts/git-hooks/pre-push.sh` 通过，且 `qa:shellcheck`、`qa:secrets` 均按阻断模式执行。
- 下一步：继续保持“日常走 full、发版前走 strict”的执行节奏。
- 阻塞/风险：无。

## 2026-02-20
- 完成：删除 `scripts/sync-quality.sh` 与 `scripts/sync-targets.txt.example`，避免对外交付代码时暴露跨仓库同步上下文。
- 完成：清理 `README.md`、`scripts/README.md`、`scripts/setup-git-hooks.sh` 中与该脚本相关的命令入口和说明。
- 下一步：无。
- 阻塞/风险：无。

## 2026-02-20
- 完成：修复 `scripts/doctor.sh` 的 Node 版本提示变量展开边界问题，将提示行变量改为 `${...}` 显式包裹，避免在特定 shell/locale 下触发 `unbound variable`。
- 验证：构造版本不一致场景执行 `doctor.sh`，现可正常输出提示且不报错。
- 下一步：无。
- 阻塞/风险：无。

## 2026-02-20
- 完成：`scripts/sync-quality.sh` 通用化改造（不再写死仓库名，支持 `--apply`、`--all-siblings`、`scripts/sync-targets*.txt` 清单，默认 dry-run）。
- 完成：新增 `scripts/sync-targets.txt.example`，并在 `README`/`scripts/README` 补充用法说明；脚本改为 Bash 3 兼容实现。
- 下一步：如需长期固定目标，可在本地维护 `scripts/sync-targets.local.txt`。
- 阻塞/风险：无。

## 2026-02-20
- 完成：按 `n` 使用习惯将版本锁定切换为 `.n-node-version`（移除 `.nvmrc`），并调整 `doctor`/脚本文档说明为 `n auto` 工作流。
- 完成：`scripts/doctor.sh` 改为按优先级读取 `.n-node-version`、`.node-version`、`.nvmrc` 进行 Node 版本提示。
- 下一步：本地执行 `n auto` 后再跑 QA 脚本，保持 Node 版本一致。
- 阻塞/风险：无。

## 2026-02-20
- 完成：新增本地质量脚本 `scripts/doctor.sh`、`scripts/qa/strict.sh`、`scripts/qa/shellcheck.sh`、`scripts/sync-quality.sh`，并新增 `.nvmrc`（Node 版本锁定）。
- 完成：更新 `scripts/setup-git-hooks.sh`，纳入新增脚本可执行权限；更新 `scripts/README.md` 与根 `README.md` 使用说明。
- 验证：执行脚本语法检查、`doctor` 检查、`--help` 冒烟通过。
- 下一步：如需启用强安全策略，可安装 `gitleaks/shellcheck` 并在关键流程启用 `strict`。
- 阻塞/风险：当前环境未安装 `gitleaks` 与 `shellcheck`，对应检查为提示模式。

## 2026-02-20
- 完成：删除 `/Users/simon/projects/webapp-template/web/link_node_modules.sh`，该脚本已不再使用。
- 下一步：无。
- 阻塞/风险：无。

## 2026-02-20
- 完成：修复 `web` 的两个 ESLint warning：`util.js` 中 `!=` 改为 `!==`，`AdminMenu` 去除 `window.confirm` 改为页面内二次确认交互，消除 `no-alert` 告警。
- 验证：执行 `pnpm --dir /Users/simon/projects/webapp-template/web lint`，当前无 warning。
- 下一步：后续新增确认交互优先使用页面内确认或组件弹层，避免再次触发 `no-alert`。
- 阻塞/风险：无。

## 2026-02-20
- 完成：修复 `/Users/simon/projects/webapp-template/web/tailwind.config.js` 的 `global-require` 告警，将插件 `require()` 从 `plugins` 数组内移动到文件顶部常量声明。
- 验证：`pnpm exec eslint tailwind.config.js` 通过。
- 下一步：后续新增 Tailwind 插件沿用顶部常量引用写法，避免再次触发 `global-require`。
- 阻塞/风险：无。

## 2026-02-20
- 完成：将根目录 `README.md` 规范为统一同构结构（项目简介、目录结构、快速开始、质量命令、门禁、文档索引、数据库迁移约束），与同目录仓库保持一致。
- 完成：保留模板项目差异内容（无前端 test 脚本说明）并归入统一章节。
- 下一步：后续若新增前端 test 脚本，需同步更新根 README 的质量命令说明。
- 阻塞/风险：无。

## 2026-02-20
- 完成：按统一规范重写根目录 `README.md`（项目简介、目录结构、快速开始、质量命令、门禁说明、文档索引），并补齐缺失的 `web/README.md`。
- 完成：规范化 `server/README.md`，修复代码块围栏不闭合导致的渲染问题；新增 `docs/README.md` 说明根级 docs 定位。
- 下一步：后续新增脚本或模块文档时，保持“目录就近 + 根 README 索引”同步更新。
- 阻塞/风险：无。

## 2026-02-19
- 完成：按目录就近原则，将脚本文档从 `/Users/simon/projects/webapp-template/docs/qa-scripts.md` 调整为 `/Users/simon/projects/webapp-template/scripts/README.md`，与目录就近文档风格一致。
- 完成：同步更新 `README.md` 中脚本文档入口链接，避免路径失效。
- 下一步：后续脚本行为变更优先维护 `scripts/README.md`，并保持三个仓库同构。
- 阻塞/风险：无。

## 2026-02-19
- 完成：为 6 项本地质量脚本补充统一可读文档 `/Users/simon/projects/webapp-template/docs/qa-scripts.md`，覆盖作用、执行时机、环境变量、失败处理与 hook 映射。
- 完成：6 项脚本增加 `-h/--help` 说明，支持终端快速查看用途与参数，降低脚本心智负担。
- 完成：`README.md` 补充 `docs/qa-scripts.md` 入口，避免脚本说明散落。
- 下一步：后续如增加新门禁脚本，先补 `docs/qa-scripts.md` 再纳入 hooks。
- 阻塞/风险：无。

## 2026-02-19
- 完成：同步接入本地 Git hooks 方案（`.githooks` + `scripts/git-hooks` + `scripts/setup-git-hooks.sh`），用于无 CI 场景的自动质量门禁。
- 完成：`pre-commit` 已配置为仅处理暂存的 `web/` 文件（`prettier` + `eslint --fix`），`pre-push` 已配置为执行 `web lint/css/test(若存在)/build` 与 `server go test/build`。
- 完成：更新 `README.md` 增加 hooks 启用与使用说明，并执行安装与校验命令。
- 下一步：按常规 `git commit`/`git push` 流程使用 hooks；如需紧急放行可临时使用 `SKIP_PRE_PUSH=1 git push`。
- 阻塞/风险：`pre-push` 全量检查耗时较长，首次执行受依赖安装与机器性能影响。

## 2026-02-15
- 完成：同步部署稳定性与迁移友好逻辑：配置改为服务名互联、compose 增加 MySQL healthcheck + depends_on 条件、增加 `.env.example`、文档补充迁移步骤（`server/configs/*`、`server/deploy/compose/prod/*`）。
- 完成：数据层新增 MySQL 启动重试窗口与单测，降低宿主机重启后数据库短暂未就绪导致的启动失败（`server/internal/data/data.go`、`server/internal/data/data_ping_retry_test.go`）。
- 下一步：部署前按目标机器复制 `.env.example` 为 `.env` 并校准路径/端口/镜像，再执行 `docker compose up -d`。
- 阻塞/风险：仓库存在大量既有前端未提交改动（与本次同步无关）；提交时需严格按文件范围选择，避免混入。

## 2026-02-20
- 完成：新增 `scripts/qa/shfmt.sh` 与 `scripts/qa/govulncheck.sh`，并接入到三处流程：`pre-commit`（staged shell 自动 `shfmt`）、`full`（govulncheck 提示模式）、`strict`（`shfmt` 检查模式 + `govulncheck` 阻断模式）。
- 完成：更新 `scripts/doctor.sh`、`scripts/setup-git-hooks.sh`、`scripts/README.md`、根 `README.md`，同步补齐工具说明与门禁行为。
- 验证：已安装 `shfmt v3.12.0`、`govulncheck v1.1.4`；执行 `scripts/qa/shfmt.sh`、`scripts/qa/govulncheck.sh`、`scripts/doctor.sh`、`scripts/git-hooks/pre-push.sh` 通过。
- 验证：`scripts/qa/strict.sh` 当前被历史漏洞基线拦截（`go.opentelemetry.io/otel/sdk@v1.38.0` -> `>=v1.40.0`，`github.com/golang-jwt/jwt/v5@v5.1.0` -> `>=v5.2.2`）。
- 下一步：按目录分批修复并升级上述依赖版本，清理后再把 `strict` 设为日常阻断。
- 阻塞/风险：严格模式暂不可全绿，阻塞点为既有依赖漏洞基线。

## 2026-02-20
- 完成：修复 `govulncheck` 阻断基线，升级 `server/go.mod` 依赖：`go.opentelemetry.io/otel/sdk` 到 `v1.40.0`、`github.com/golang-jwt/jwt/v5` 到 `v5.2.2`（并同步相关 OTel 子模块版本）。
- 验证：`bash scripts/qa/strict.sh` 已全通过；`bash scripts/git-hooks/pre-push.sh` 已全通过。
- 下一步：继续按目录分批清理历史质量问题，优先做与业务改动同目录的小批次。
- 阻塞/风险：无。

## 2026-02-20
- 完成：按三仓库同步审计结果新增根级 `.gitignore`，统一忽略项（`.cursor`、`.DS_Store`、`web/node_modules`、`web/build`、`server/bin`、`output/`、`.playwright-cli/`）。
- 下一步：如后续新增工具缓存目录（如 coverage/sbom 报告目录），继续三仓库同批补充忽略规则。
- 阻塞/风险：无。

## 2026-03-02
- 完成：新增本地一键发布脚本 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh`，串联 `make build_server`、`docker save`、`rsync` 与远端 `deploy_server.sh`，默认对接 `root@47.84.12.211`。
- 完成：发布脚本新增 `AUTO_SMOKE` 部署后自动检查（`off/basic/auto/strict`），默认 `auto` 按最近改动路径自动判定；命中后端关键目录（`server/internal`、`server/cmd`、`server/configs`、迁移目录等）自动走 `strict`。
- 完成：检查项包含 `healthz/readyz`、远端容器状态；`strict` 模式额外检查首页可达性并扫描容器日志 `panic/fatal`。
- 完成：同步更新部署文档 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md`，补齐一键发布命令、环境变量与自动检查策略说明。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 通过；`publish_server.sh --help` 输出正常且包含新增参数。
- 下一步：在目标服务器执行一次 `sh /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 实机验证，确认自动判定与健康检查结果符合预期。
- 阻塞/风险：`publish_server.sh` 默认 `IMAGE_NAME=simulator-server:dev`（与当前 `server/Makefile` 产物一致）；若后续镜像名切换为 `template-server:*`，需同步覆盖 `IMAGE_NAME` 或调整 Makefile。

## 2026-03-02
- 完成：修正跨项目部署混淆风险：`publish_server.sh` 改为默认上传到项目独立远端目录 `~/deploy/webapp-template`，并使用项目专属远端脚本名 `deploy_webapp_template_server.sh` 与专属 compose 文件名 `compose.webapp-template.yml`。
- 完成：发布流程新增“上传 deploy_server.sh + compose.yml”步骤，再以 `COMPOSE_FILE=./compose.webapp-template.yml` 执行远端部署，避免复用 `~/deploy_server.sh` 与 `~/compose.yml` 引发串项目。
- 完成：同步更新部署文档 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md`，明确新的远端默认路径、脚本名和 compose 文件名。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 通过；`publish_server.sh --help` 输出已更新隔离参数说明。
- 下一步：在目标服务器首次执行发布前，建议确认远端目录 `~/deploy/webapp-template` 对应 `.env` 配置（若依赖自定义变量）。
- 阻塞/风险：若远端原有部署依赖 `~/.env` 或 `~/compose.yml`，迁移到独立目录后需同步放置项目级 `.env`，否则将回退到 compose 默认值。

## 2026-03-03
- 完成：完善发布脚本首发稳定性：在 `publish_server.sh` 中将远端目录创建前置到镜像上传前（`ssh mkdir -p` 先执行，再 `rsync` 镜像），避免首次部署时因目标目录不存在导致上传失败。
- 完成：保持与 `collision-simulator`、`trade-erp` 发布流程一致，三仓库发布链路已统一为“先建目录 -> 传镜像 -> 传脚本/compose -> 远端执行 -> 自动检查”。
- 验证：`sh -n /Users/simon/projects/webapp-template/server/deploy/compose/prod/publish_server.sh` 通过；`publish_server.sh --help` 输出正常。
- 下一步：建议在新机器首次部署时直接执行一遍发布脚本，验证目录自动创建与镜像上传链路。
- 阻塞/风险：无。

## 2026-03-03
- 完成：部署拓扑去耦：`server/deploy/compose/prod/compose.yml` 移除外部共享网络依赖，不再引用 `collision-simulator_default`；`mysql/jaeger` 容器名改为 `webapp-template-*` 前缀。
- 完成：默认运行参数改为项目专属：镜像默认 `webapp-template-server:dev`，MySQL 数据目录默认 `/data/webapp-template/mysql/*`，并将 MySQL/Jaeger 默认映射端口调整为与其他项目不冲突。
- 完成：`deploy_server.sh` 删除共享网络自动识别与补挂逻辑，仅保留本项目容器重建；`migrate_online.sh` 删除跨项目 MySQL 容器兜底匹配，只按当前 compose 服务解析。
- 完成：同步更新 `server/Makefile`、`publish_server.sh`、`server/deploy/compose/prod/.env.example` 与 `README.md`，确保脚本、默认值、文档口径一致。
- 验证：`sh -n server/deploy/compose/prod/deploy_server.sh`、`sh -n server/deploy/compose/prod/publish_server.sh`、`sh -n server/deploy/compose/prod/migrate_online.sh` 通过；`docker compose -f server/deploy/compose/prod/compose.yml config` 通过。
- 下一步：远端切换时先执行一次 `docker compose -f compose.webapp-template.yml up -d` 全量拉起（含 MySQL/Jaeger），确认新容器名与端口生效后再执行增量发布。
- 阻塞/风险：若远端已有旧版 `mysql8/jaeger` 或旧端口占用，首次切换可能冲突，需要先停掉旧容器或改用自定义 `.env` 端口。

## 2026-03-03
- 完成：按低资源主机要求下调默认内存上限（`server/deploy/compose/prod/compose.yml`）：`webapp-template-mysql` 从 `2g/1g` 下调为 `512m/256m`，`webapp-template-jaeger` 新增 `192m/96m` 限制，`webapp-template-server` 从 `1g/512m` 下调为 `128m/64m`。
- 完成：线上运行态按共享依赖策略执行限额，`webapp-template-server` 在线下发为 `128m/64m` 且保持 `restart=no`，避免主机重启后批量自启雪崩。
- 验证：远端 `http://127.0.0.1:8200/healthz` 返回 `200`；`docker stats` 观察 `webapp-template-server` 内存约 `25MiB/128MiB`，稳定运行。
- 下一步：若后续出现峰值 OOM，再把 `webapp-template-server` 提升到 `160m/80m` 并复测。
- 阻塞/风险：若误执行 `docker compose up -d` 全量拉起本项目 mysql/jaeger，会额外占用内存；当前建议继续复用 collision-simulator 的共享依赖。

## 2026-03-03
- 完成：清理跨项目服务标识残留，将 `server/cmd/server/main.go` 的 `Name/TraceName` 从 `simulator-server*` 改为 `webapp-template-server*`，避免与其他项目日志和链路追踪混淆。
- 验证：`cd /Users/simon/projects/webapp-template/server && go test ./cmd/server` 通过；`rg -n --hidden -g '!**/.git/**' -g '!progress.md' -e 'collision-simulator|trade-erp|simulator-server' /Users/simon/projects/webapp-template` 结果为空。
- 下一步：如需历史文档完全无跨项目字样，可再单独清理 `progress.md` 历史记录。
- 阻塞/风险：无。

## 2026-03-03
- 完成：清理 `server/api/jsonrpc/v1/jsonrpc.proto` 中易引起跨项目误解的示例注释，将 `collision.*` 示例替换为 `erp.*` 示例，并重新生成对应产物（`jsonrpc.pb.go`、`jsonrpc_grpc.pb.go`、`jsonrpc_http.pb.go`、`jsonrpc.swagger.json`），确保源文件与生成文件口径一致。
- 验证：`rg -n --hidden -g '!**/.git/**' 'collision\\.|\\bcollision\\b|colli' /Users/simon/projects/webapp-template/server/api/jsonrpc/v1` 结果为空。
- 下一步：如需彻底消除历史语义歧义，可进一步把 `erp.*` 改为中性 `domain.*` 示例（仅文案层变更）。
- 阻塞/风险：无。

## 2026-03-07
- 完成：移除前端目录下已不再使用的 `/Users/simon/projects/webapp-template/web/nginx.conf`，避免仓库继续保留无实际消费方的 Nginx 配置。
- 完成：新增 `/Users/simon/projects/webapp-template/web/.dockerignore`，排除宿主机 `node_modules` 与本地产物，修复 `web/Dockerfile` 在 `COPY . .` 时覆盖容器依赖目录的问题。
- 完成：回归验证 `docker build -f /Users/simon/projects/webapp-template/web/Dockerfile -t webapp-template-web-no-nginx-verify /Users/simon/projects/webapp-template/web` 通过，确认移除 Nginx 配置后前端仍可稳定产出构建结果。
- 下一步：若后续希望规范跨项目前端构建链路，可把同类 `.dockerignore` 模板下沉为统一脚手架约定。
- 阻塞/风险：当前前端 Dockerfile 为纯构建镜像，不再承诺容器内直接提供静态站点服务；若未来需要单独运行前端容器，需补新的运行时镜像方案。

## 2026-03-07
- 完成：将 `/Users/simon/projects/webapp-template/server/Dockerfile` 的平台声明从硬编码 `linux/amd64` 收口为“构建阶段跟随 `BUILDPLATFORM`、运行阶段默认 `RUNTIMEPLATFORM=linux/amd64`、Go 目标架构独立显式控制”的写法，消除 Docker `--platform` 常量告警，同时保持现有 amd64 产物口径不变。
- 完成：回归验证 `docker build -f /Users/simon/projects/webapp-template/server/Dockerfile -t webapp-template-server-platform-clean-final /Users/simon/projects/webapp-template` 通过，未再出现 `FromPlatformFlagConstDisallowed` / `RedundantTargetPlatform` 告警。
- 下一步：若后续确需支持 arm64 产物，可在构建入口统一覆盖 `RUNTIMEPLATFORM`、`GO_TARGETOS`、`GO_TARGETARCH`，避免各项目手工分散修改。
- 阻塞/风险：当前构建日志仍会出现 `go mod download && go mod tidy` 阶段的 `go: warning: "all" matched no packages` 提示，属既有构建顺序问题，不影响本次镜像产出。

## 2026-03-07
- 完成：将 `/Users/simon/projects/webapp-template/server/Dockerfile` 预热依赖阶段的 `go mod download && go mod tidy` 收口为仅执行 `go mod download`，去掉无源码上下文下的 `go: warning: "all" matched no packages` 构建提示。
- 完成：回归验证 `docker build -f /Users/simon/projects/webapp-template/server/Dockerfile -t webapp-template-server-no-tidy-warning-verify /Users/simon/projects/webapp-template` 通过，日志中不再出现该提示。
- 下一步：若后续要继续压缩构建日志噪音，可再评估是否把前端依赖安装阶段的 `npm notice` 与 `pnpm approve-builds` 提示一起处理。
- 阻塞/风险：当前镜像构建不再在 Docker 内执行 `go mod tidy`；如后续确需自动整理依赖，应放回开发脚本或 CI 校验，而不是运行时镜像构建阶段。

## 2026-03-07
- 完成：将 `/Users/simon/projects/webapp-template/web/Dockerfile` 与 `/Users/simon/projects/webapp-template/web/.dockerignore` 移入系统回收站，收口为仅通过 `/Users/simon/projects/webapp-template/server/Dockerfile` 一次性完成前端构建与服务端镜像打包，避免继续维护重复的独立前端 Docker 入口。
- 完成：复核仓库内正式文档与脚本入口，当前无额外 README/脚本依赖独立 `web/Dockerfile`；历史 `progress.md` 记录保留作为演进轨迹。
- 下一步：若后续需要统一团队构建口径，可在发版说明或部署手册中明确“以 `server/Dockerfile` 作为唯一镜像构建入口”。
- 阻塞/风险：独立前端镜像构建入口已移除；若外部仍有旧脚本直接调用 `/Users/simon/projects/webapp-template/web/Dockerfile`，需要同步切换到 `/Users/simon/projects/webapp-template/server/Dockerfile`。

## 2026-03-07
- 完成：为模板仓库新增统一错误码目录与唯一性校验，集中维护服务端对外错误码，并补充“仅登录态失效才触发重新登录”的分类函数，避免继续散落魔法数字或一码多义（`/Users/simon/projects/webapp-template/server/internal/errcode/catalog.go`、`/Users/simon/projects/webapp-template/server/internal/errcode/catalog_test.go`）。
- 完成：将 `/Users/simon/projects/webapp-template/server/internal/data/jsonrpc.go` 改为引用统一错误码目录，修正历史语义冲突：`40302` 仅表示“未登录”，`40303` 仅表示“管理员已禁用”，`40304` 统一表示“权限不足”；同时把订阅类参数错误码从与用户管理冲突的 `40060~40064` 收口到独立段 `40080~40084`。
- 完成：新增前端错误码常量并改造公共错误处理，只在 `AUTH_REQUIRED / AUTH_EXPIRED / AUTH_INVALID` 时清 token 与跳登录，避免把权限不足误处理成登出（`/Users/simon/projects/webapp-template/web/src/common/consts/errorCodes.js`、`/Users/simon/projects/webapp-template/web/src/common/utils/jsonRpc.js`、`/Users/simon/projects/webapp-template/web/src/common/utils/errorMessage.js`）。
- 完成：新增错误码魔法数字守卫并接入 `fast/full/pre-commit`，同时把错误码治理约定补充到仓库说明，降低后续 AI/人工改动再次写散错误码的概率（`/Users/simon/projects/webapp-template/scripts/qa/error-codes.sh`、`/Users/simon/projects/webapp-template/scripts/qa/fast.sh`、`/Users/simon/projects/webapp-template/scripts/qa/full.sh`、`/Users/simon/projects/webapp-template/scripts/git-hooks/pre-commit.sh`、`/Users/simon/projects/webapp-template/AGENTS.md`、`/Users/simon/projects/webapp-template/README.md`、`/Users/simon/projects/webapp-template/scripts/README.md`）。
- 验证：`bash /Users/simon/projects/webapp-template/scripts/qa/error-codes.sh`；`cd /Users/simon/projects/webapp-template/server && go test ./internal/errcode ./internal/data`；`cd /Users/simon/projects/webapp-template/web && pnpm exec eslint --no-warn-ignored src/common/consts/errorCodes.js src/common/utils/jsonRpc.js src/common/utils/errorMessage.js`；`bash /Users/simon/projects/webapp-template/scripts/qa/fast.sh`；`bash /Users/simon/projects/webapp-template/scripts/qa/full.sh`。
- 下一步：建议后续新项目直接从本模板复制错误码目录、前端常量和 `error-codes` 守卫，把“错误码统一治理”作为默认脚手架能力保留下去。
- 阻塞/风险：`scripts/qa/full.sh` 过程中 `govulncheck` 仍提示当前 Go `1.26.0` 标准库漏洞告警（修复版本为 `1.26.1`），但该脚本当前默认仅提示不阻断；若要把模板质量门禁也收口为全绿，后续仍需单独升级模板 Go 工具链与 Docker 构建基线。
