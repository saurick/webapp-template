# 压测脚本说明

这套目录提供一组最小可跑的 `k6` 压测脚本，目标是先验证 `webapp-template` 的健康检查、基础 JSON-RPC 和鉴权链路，不额外引入压测平台。

## 场景总览

| 场景 | 默认目标 | 适用说明 |
| --- | --- | --- |
| `health` | `/healthz` + `/readyz` | 验证基础可用性与就绪检查 |
| `system` | `system.ping` + `system.version` | 验证无鉴权 JSON-RPC 入口 |
| `auth` | `auth.register/login` + `auth.me` | 验证登录态链路 |
| `mixed` | `health + system + auth` | 第一轮联调默认入口 |

## 快速开始

### 1. 本地开发环境

```bash
BASE_URL=http://127.0.0.1:8200 \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh mixed
```

### 2. 指定 k6 参数

```bash
BASE_URL=http://127.0.0.1:8200 \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh health \
  --vus 10 \
  --duration 1m
```

### 3. 复用已有账号做登录压测

```bash
BASE_URL=http://127.0.0.1:8200 \
LOADTEST_AUTH_MODE=login \
LOADTEST_USERNAME=alice \
LOADTEST_PASSWORD='Passw0rd!123' \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh auth \
  --vus 1 \
  --iterations 20
```

### 4. 不想输入命令时

优先直接用 Portal 一键触发：

```text
http://192.168.0.108:30088
```

兜底仍可用 GitLab 新建页：

```text
http://192.168.0.108:8929/root/webapp-template-lab/-/pipelines/new?ref=master&var[PIPELINE_MODE]=loadtest&var[LOADTEST_SCENARIO]=system
```

Portal 里点 `运行压测` 时，会直接用当前浏览器里的 GitLab 登录态触发安全默认的 `system` 场景，不再先跳 GitLab 新建页。
默认会跑安全的 `system` 场景，并把 `report.html` / `summary.json` 保留成 GitLab artifacts。
如果当前浏览器已经登录过 GitLab，`http://192.168.0.108:30088` 的 Portal 还会直接显示最近一次 `loadtest_lab` 的状态摘要、当前流水线入口和结果入口。
Portal 的“最近一次压测”卡片还会标出当前引擎是 `k6` 还是 `curl-fallback`；若本轮使用 `k6` 并已写入 Prometheus，则会直接给出 Grafana 看板入口。
如果当前 run 使用的是 `k6` 引擎，额外还会把时序写进 `http://192.168.0.108:30081/d/lab-ha-loadtest/ha-lab-load-test`。
如果你想看更完整的官方指标布局，也可以打开 `http://192.168.0.108:30081/d/lab-ha-loadtest-official/ha-lab-load-test-official-k6`。

对当前 `lab-ha` 的 `GitLab shell runner`，推荐做法是把固定版本 `k6` 预装到 runner 宿主机，而不是指望每轮压测现场在线下载。仓库提供了安装脚本：

```bash
bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-runner-k6.sh
```

## 运行方式

- `run.sh` 优先使用本机 `k6`
- 对 `GitLab shell runner`，宿主机预装 `k6` 是推荐路径；这样才能稳定写入 Grafana，而不是受外网下载波动影响退化到 `curl fallback`
- 本机未安装 `k6`、但存在 `curl + tar` 时，可为“本地临时机/一次性环境”下载固定版本 `k6` 二进制到本地缓存目录；这不是 `GitLab shell runner` 的推荐基线
- 本机未安装 `k6`、也无法下载二进制，但存在 `go` 工具链时，可继续在“本地临时机/一次性环境” fallback 到 `go install go.k6.io/k6@v0.49.0`
- 如果当前环境既没有可用 `k6`，也没有 `go/docker`，则 `health/system` 会自动退化到仓库内置的 `curl` fallback，继续产出 `summary.json + report.html`
- 本机既没有本机 `k6`、也没有可用下载/`go` 兜底时，才在“本地临时机/一次性环境” fallback 到 `docker run grafana/k6`
- fallback 到 Docker 时，如果 `BASE_URL` 是 `localhost/127.0.0.1`，脚本会自动改写成 `host.docker.internal`

## 结果输出

每次运行都会在下面目录创建独立结果：

```text
server/deploy/lab-ha/artifacts/loadtest/<LOADTEST_RUN_ID>/
```

默认包含：

- `summary.json`：压测汇总结果；有 `k6` 时来自 `k6 --summary-export`，`curl fallback` 时保持同一关键指标结构
- `report.html`：静态报告；有 `k6` 时来自 Web Dashboard 导出，`curl fallback` 时由脚本生成最小 HTML 摘要
- `meta.env`：本次压测的关键信息

GitLab `loadtest_lab` 还会把当前 job 的关键产物额外复制到固定路径，便于 Portal 直接读取：

- `server/deploy/lab-ha/artifacts/loadtest/job/portal-summary.json`
- `server/deploy/lab-ha/artifacts/loadtest/job/summary.json`
- `server/deploy/lab-ha/artifacts/loadtest/job/report.html`

说明：

- `meta.env` 会记录 `LOADTEST_ENGINE=k6|docker|curl-fallback`
- `meta.env` 也会记录本轮是否启用了 `LOADTEST_PROMETHEUS_RW_URL`
- 几秒级超短 smoke 可能因为“数据不足”被 `k6` 直接跳过导出；这时仍会保留 `summary.json`
- `curl fallback` 当前只覆盖最常用的 `health/system`，`auth/mixed` 仍建议在具备 `k6` 的环境执行；同时 `curl fallback` 不会把时序写进 Grafana，只保留 GitLab artifacts

## 关键环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `BASE_URL` | `http://127.0.0.1:8200` | 目标服务入口 |
| `LOADTEST_HOST_HEADER` | 空 | 需要 Host 路由时显式覆盖 |
| `LOADTEST_RUN_ID` | 自动生成 | 当前压测批次 ID |
| `LOADTEST_AUTH_MODE` | 自动推断 | `register` 或 `login` |
| `LOADTEST_USERNAME` | 空 | `login` 模式账号 |
| `LOADTEST_PASSWORD` | `Passw0rd!123` | `login` 模式密码；`register` 模式也复用它 |
| `LOADTEST_THINK_TIME_MS` | `500` | 每轮请求后 sleep |
| `LOADTEST_LOGOUT_AFTER_AUTH` | `false` | `auth` 场景结束前是否调用 `logout` |
| `LOADTEST_PROMETHEUS_RW_URL` | 空 | 非空时启用 k6 -> Prometheus remote write，供 Grafana 统一看板使用 |
| `LOADTEST_K6_DOWNLOAD_URL` | 官方 GitHub release | 可选覆盖下载地址，便于后续切到内网镜像源 |
| `K6_WEB_DASHBOARD` | `true` | 是否开启 dashboard |
| `K6_WEB_DASHBOARD_PORT` | `5665` | dashboard 端口 |

## 设计约束

- 默认 `auth` / `mixed` 会优先走 `register`，避免仓库必须预置测试账号
- `register` 模式会创建真实用户，建议在开发环境、试验命名空间或独立数据库里使用
- 每个请求都会带 `X-Request-Id`，格式以 `LOADTEST_RUN_ID` 开头，便于结合现有日志的 `request_id` 字段筛选这一轮流量
- 额外附带 `X-Loadtest-Run-Id`，便于后续如果网关/代理要补维度时直接复用
