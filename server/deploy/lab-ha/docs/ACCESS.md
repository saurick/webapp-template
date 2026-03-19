# 访问地址与凭据

## 访问入口

说明：当前用户侧浏览器/代理环境对 `*.nip.io` 这类主机名不稳定，因此实验室对外访问已统一切到 `192.168.0.108` 的直连 `IP:Port` 方案；这是目前最稳、最直接、最少踩坑的入口口径。

- WebApp: `http://192.168.0.108:32668`
- Portal: `http://192.168.0.108:30088`
- Harbor: `http://192.168.0.108:30002`
- Grafana: `http://192.168.0.108:30081`
- Prometheus: `http://192.168.0.108:30090`
- Alertmanager: `http://192.168.0.108:30093`
- Argo CD: `https://192.168.0.108:30443`
- Hubble UI: `http://192.168.0.108:30085`
- Longhorn UI: `http://192.168.0.108:30084`
- SeaweedFS Filer UI: `http://192.168.0.108:30888`
- Alert Sink: `http://192.168.0.108:30086`
- SeaweedFS S3: `http://192.168.0.108:30333`
- GitLab: `http://192.168.0.108:8929`

## S3 endpoint note

- `http://192.168.0.108:30333` is the SeaweedFS S3 API endpoint
- It is expected to return `AccessDenied` in a normal browser tab because the browser does not sign S3 requests
- For a human-friendly UI, use `http://192.168.0.108:30888`

## Portal note

- Portal is the navigation homepage for this lab environment
- It now includes a dedicated favicon and one-click copy buttons for default credentials

## 当前实验室默认凭据

- WebApp admin: `admin / AdminLab123!`
- WebApp test user: `labuser1 / LabUser123!`
- Harbor admin: `admin / HarborAdmin123!`
- Grafana admin: `admin / Grafana123!`
- Argo CD admin: `admin / aLgJjYwPdezuEzSw`
- GitLab root: `root / L4b!Runr2026#Git`

## 若后续忘记密码

- Grafana:
  - `kubectl -n monitoring get secret kube-prometheus-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d`
- Argo CD:
  - `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`
- GitLab root:
  - `ssh root@192.168.0.108 "gitlab-rails runner -e production 'puts User.find_by(username: %q[root]).username'"`
  - 如需重置密码，使用 `gitlab-rails runner` 直接写入新密码

## 集群入口与节点

- API VIP: `192.168.0.110:6443`
- ingress NodePort HTTP: `192.168.0.108:32668`
- ingress NodePort HTTPS: `192.168.0.108:30943`
- node1: `192.168.0.7`
- node2: `192.168.0.108`
- node3: `192.168.0.128`

## Git 远程建议

- `origin`: 继续保留 GitHub 模板上游
- `gitlab`: 当前实验室部署仓库，建议用于 CI/CD / Argo CD / 演练环境
- 默认不要同时推两个远程，除非明确说明

## 历史入口说明

- `*.192.168.0.108.nip.io:32668` 这组基于 Host 头的入口仍保留在集群内配置里
- 但对当前浏览器环境不再作为主推荐入口
- 后续若本机代理绕过规则已修好，可再切回主机名入口
