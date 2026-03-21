# 实验室压测说明

这份文档说明如何在当前 `lab-ha` 环境里使用仓库内置的最小压测脚本，不额外引入独立压测平台。

## 目标

- 补齐高可用实验在“可重复施压”上的最小能力
- 优先验证 `healthz / readyz`、基础 JSON-RPC 和鉴权链路
- 复用现有 `Prometheus + Grafana + Loki + Jaeger` 观察结果

## 入口脚本

- 统一入口：`/Users/simon/projects/webapp-template/scripts/loadtest/run.sh`
- 通用说明：`/Users/simon/projects/webapp-template/scripts/loadtest/README.md`
- `run.sh` 优先用本机 `k6`；没有本机 `k6` 时，会先尝试下载固定版本 `k6` 二进制，再尝试 `go install go.k6.io/k6@v0.49.0`，最后才回退到 `docker run grafana/k6`

## GitLab 一键入口

如果你不想在本地输入命令，当前推荐入口是 GitLab 手动流水线：

- 新建入口：`http://192.168.0.108:8929/root/webapp-template-lab/-/pipelines/new?ref=master&var[PIPELINE_MODE]=loadtest&var[LOADTEST_SCENARIO]=system`

使用方式：

1. 打开上面的地址
2. 保持默认 `system` 场景，直接点 `Run pipeline`
3. 等待 `validate_lab -> loadtest_lab` 执行完成
4. 在当前 job 的 artifacts 里打开 `report.html`

说明：

- 这条入口默认预填 `PIPELINE_MODE=loadtest` 与 `LOADTEST_SCENARIO=system`
- `system` 是当前最安全的一键场景：会打到真实业务入口，但不会创建用户
- 如果要切换到 `health`、`auth` 或 `mixed`，可在 GitLab 新建流水线页改变量
- `auth` / `mixed` 默认仍是 `register` 模式，会创建真实用户；如需改成 `login`，请在 GitLab 页面额外提供 `LOADTEST_USERNAME` 和 `LOADTEST_PASSWORD`
- 如果当前浏览器已经登录过 GitLab，`http://192.168.0.108:30088` 的 Portal 会自动展示“最近一次压测”摘要卡片，并给出 `Open pipeline / Open report` 入口
- `loadtest_lab` 会在每个 job artifact 里额外写一份固定路径副本：`server/deploy/lab-ha/artifacts/loadtest/job/{portal-summary.json,summary.json,report.html}`，方便 Portal 直接读取最近一次结果
- 很短的压测（例如几秒级 smoke）可能会被 `k6` 跳过 HTML 报告导出，这种情况下 Portal 仍会展示状态和 `summary.json` 指标，但不会给 `Open report`

## 推荐执行顺序

1. 先跑健康检查，确认当前目标环境可达
2. 再跑 `system`，确认 JSON-RPC 基础入口稳定
3. 最后跑 `auth` 或 `mixed`

## 常用示例

### 1. 直接打实验室稳定入口

```bash
BASE_URL=http://192.168.0.108:32668 \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh health \
  --vus 10 \
  --duration 1m
```

### 2. 走内部域名 Host 路由

```bash
BASE_URL=http://192.168.0.7:32668 \
LOADTEST_HOST_HEADER=webapp-trial.lab.home.arpa \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh system
```

### 3. 先用最保守的联调场景

```bash
BASE_URL=http://192.168.0.108:32668 \
LOADTEST_AUTH_ITERATIONS=2 \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh mixed
```

### 4. 如果已经准备好固定测试账号

```bash
BASE_URL=http://192.168.0.108:32668 \
LOADTEST_AUTH_MODE=login \
LOADTEST_USERNAME=loadtest_user \
LOADTEST_PASSWORD='Passw0rd!123' \
bash /Users/simon/projects/webapp-template/scripts/loadtest/run.sh auth \
  --vus 1 \
  --iterations 20
```

## 观测建议

- 当前脚本会给每个请求带 `X-Request-Id`
- `request_id` 前缀使用 `LOADTEST_RUN_ID`
- 现有服务端已支持透传 `X-Request-Id`，所以可以直接在日志里按 `request_id=<LOADTEST_RUN_ID...>` 过滤
- GitLab 手动流水线跑出来的 `report.html` 和 `summary.json` 都作为 artifacts 保留在 `192.168.0.108:8929`，不再依赖本地 `127.0.0.1` dashboard

建议同步观察：

- Grafana 总览：先看整体资源和错误率
- Loki：按 `request_id` 前缀过滤这一轮压测流量
- Jaeger：从 sampled 日志继续点 trace，看慢请求集中在哪条链路

## 风险边界

- `auth` / `mixed` 默认使用 `register` 模式，会创建真实用户
- 当前脚本是“最小能力”，不是分布式压测平台，不负责历史趋势归档、多人协作和长期调度
- 在 `3 x 4C/8G` 实验资源下，不建议一开始就把 `vus` 拉得很高；优先用保守并发观察拐点
