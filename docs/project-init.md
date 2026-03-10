# 新项目初始化指南

本文档用于说明：当你把 `webapp-template` 复制成一个新仓库后，应该如何快速把模板收口成“当前项目”。

## 目标

- 尽快替换模板残留，避免后续开发继续沿用旧项目名、旧部署地址、旧账号配置。
- 保留模板里真正通用、低成本且高复用的工程基线。
- 让 AI 在初始化后的第一轮改动里就有明确边界，不再靠人工补口头约定。

## 推荐流程

### 1. 先跑初始化扫描

```bash
cd /path/to/your-project
bash scripts/init-project.sh
```

这个脚本会分两类输出：

- 必须处理：项目名、服务名、默认密码、远端主机、模板文档语义等。
- 建议确认：K8s 残留、远端发布脚本、Jaeger、后台业务骨架等。

### 2. 完成模板收口

优先处理以下内容：

- 项目名、服务名、镜像名、容器名、页面标题
- README / AGENTS / 首页文案中的模板措辞
- 默认密钥、数据库密码、默认管理员账号
- 远端发布主机、目录、compose 文件名
- `server/deploy/` 下 Compose / K8s 部署模板里的占位符、域名、镜像仓库和命名空间
- 是否保留 K8s / Jaeger / 远端 SSH 发布脚本
- 后台默认现仅保留账号目录和项目收口说明页；积分、订阅、层级管理、邀请码等业务模块已从模板主干移除，若项目需要，应在派生项目按真实需求新增

说明：

- 通用工程能力建议保留：质量门禁、错误码治理、最小健康检查、基础可观测性。
- 不需要的部署方式或模块，默认移动到系统回收站，不做不可恢复删除。
- 当前模板已提供完整的 Compose 与 Kubernetes 部署骨架；入口说明见 `/Users/simon/projects/webapp-template/server/deploy/README.md`，K8s 细节见 `/Users/simon/projects/webapp-template/server/docs/k8s.md`。

### 3. 跑本地环境与质量检查

```bash
bash scripts/bootstrap.sh
bash scripts/doctor.sh
bash scripts/init-project.sh --project --strict
bash scripts/qa/fast.sh
bash scripts/qa/full.sh
```

## 模板里通常建议保留的能力

- `/healthz`、`/readyz` 与数据库启动就绪等待
- 错误码统一治理与同步校验
- `pre-commit` / `pre-push` / `doctor` / `fast` / `full` / `strict`
- 登录、注册、管理员登录、账号目录与通用鉴权骨架
- 基本日志 / trace 约束

## 模板里通常按需裁剪的能力

- K8s 部署清单与 dashboard
- Jaeger / OTLP / Prometheus 相关 compose 服务
- 远端一键发布脚本与默认 SSH 发布流程
- 任何项目特有的会员体系、邀请码体系、组织层级、积分体系

## 给 AI 的标准提示词

```text
请对当前仓库做一次模板收口：
1. 先执行 bash scripts/init-project.sh 并按输出处理所有必须项；
2. 将模板项目名、服务名、镜像名、页面标题、文档措辞改成当前项目事实；
3. 替换默认密码、JWT 密钥、数据库名、远端主机与部署目录；
4. 删除当前项目不会使用的部署方式和业务模块，默认移动到系统回收站；
5. 保留通用工程基线：质量门禁、错误码治理、最小健康检查、基础可观测性；
6. 最后执行 bash scripts/init-project.sh --project --strict、bash scripts/qa/fast.sh、bash scripts/qa/full.sh。
```
