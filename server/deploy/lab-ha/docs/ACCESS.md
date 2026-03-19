# 访问地址与凭据

## 访问入口

说明：当前虚拟化网络下，MetalLB VIP 对外部机器不稳定，因此统一采用 `node2 (192.168.0.108)` 的 ingress NodePort 暴露站点。

- WebApp: `http://app.192.168.0.108.nip.io:32668`
- Harbor: `http://harbor.192.168.0.108.nip.io:32668`
- Grafana: `http://grafana.192.168.0.108.nip.io:32668`
- Prometheus: `http://prometheus.192.168.0.108.nip.io:32668`
- Alertmanager: `http://alertmanager.192.168.0.108.nip.io:32668`
- Argo CD: `http://argocd.192.168.0.108.nip.io:32668`
- Hubble UI: `http://hubble.192.168.0.108.nip.io:32668`
- Longhorn UI: `http://longhorn.192.168.0.108.nip.io:32668`
- SeaweedFS Filer UI: `http://seaweedfs.192.168.0.108.nip.io:32668`
- Alert Sink: `http://alertsink.192.168.0.108.nip.io:32668`
- SeaweedFS S3: `http://192.168.0.108:30333`
- GitLab: `http://192.168.0.108:8929`

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
