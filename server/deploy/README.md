# server/deploy 部署模板说明

`server/deploy` 提供两套部署模板，方便派生项目按实际环境二选一或按需裁剪：

- `compose/prod/`：单机或单宿主机的 Docker Compose 模板
- `dev/`、`prod/`：Kubernetes 环境模板，分别对应开发与生产基线
- `dashboard/`：可选的 Kubernetes Dashboard 辅助清单
- `confs/mysql8.cnf`：Compose 场景下可复用的 MySQL 配置样例

## 目录说明

### Compose 模板

- 入口目录：`/Users/simon/projects/webapp-template/server/deploy/compose/prod`
- 适合：单项目单机、单台云主机、人工发布或 SSH 增量发布
- 关键文件：
  - `compose.yml`
  - `.env.example`
  - `deploy_server.sh`
  - `publish_server.sh`
  - `migrate_online.sh`

说明：详细用法见 `/Users/simon/projects/webapp-template/server/deploy/compose/prod/README.md`。

### Kubernetes 模板

- 入口目录：
  - `/Users/simon/projects/webapp-template/server/deploy/dev`
  - `/Users/simon/projects/webapp-template/server/deploy/prod`
- 适合：已有集群、标准化镜像仓库、需要 `startupProbe/readinessProbe/livenessProbe` 的场景
- 每个环境目录当前都包含：
  - `namespace.yaml`
  - `kustomization.yaml`
  - `configmap.yaml`
  - `secret.yaml`
  - `service.yaml`
  - `deployment.yaml`

说明：详细用法见 `/Users/simon/projects/webapp-template/server/docs/k8s.md`。

### Dashboard 辅助清单

- 入口目录：`/Users/simon/projects/webapp-template/server/deploy/dashboard`
- 适合：集群已安装 Kubernetes Dashboard，且希望快速暴露一个内网入口
- 关键文件：
  - `dashboard-admin-token.yaml`
  - `kubernetes-dashboard-ingress.yaml`

说明：详细用法见 `/Users/simon/projects/webapp-template/server/deploy/dashboard/README.md`。

## 初始化后必须替换的占位符

以下值只适合模板源仓库，派生项目必须按真实环境替换：

- `your-project`
- `your-project-server`
- `registry.example.com`
- `deploy.example.com`
- `dashboard.example.local`
- `replace-me`
- `otel-collector.observability.svc.cluster.local`
- `prometheus:9090`

建议初始化后先执行：

```bash
bash /Users/simon/projects/webapp-template/scripts/init-project.sh
```

然后按项目实际情况决定：

- 只用 Compose：保留 `server/deploy/compose/prod`，删除 K8s 清单与 dashboard
- 只用 Kubernetes：保留 `server/deploy/dev`、`server/deploy/prod`，按需删除 Compose 发布脚本
- 两套都保留：文档里明确哪套是当前项目主路径，避免后续 AI 和人工混用

说明：删除不需要的部署模板时，默认移动到系统回收站，不做不可恢复删除。
