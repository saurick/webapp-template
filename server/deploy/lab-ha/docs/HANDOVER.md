# 接手说明

## 当前状态

- 集群 kubeconfig（本机）: `/Users/simon/.kube/ha-lab.conf`
- GitLab: 宿主机 `192.168.0.108:8929`
- Harbor / Grafana / Prometheus / Argo CD / WebApp: 统一走 `192.168.0.108:32668` + Host 域名
- 实验室部署清单集中在 `server/deploy/lab-ha/`
- `webapp-template` 运行镜像当前已切到 Harbor：`harbor.192.168.0.108.nip.io:32668/library/webapp-template-server:ha-lab`
- GitLab Runner 已经 `verify` 通过，`.gitlab-ci.yml` 也已通过 GitLab CI Lint
- Argo CD 仓库凭据已改为 `SealedSecret` 管理，避免明文仓库密码落库
- Velero 当前只做对象级备份，不默认承担 PVC 数据面恢复

## 后续 AI 优先检查项

1. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get nodes`
2. `kubectl --kubeconfig /Users/simon/.kube/ha-lab.conf get pods -A`
3. `curl --noproxy '*' -H 'Host: app.192.168.0.108.nip.io' http://192.168.0.108:32668/readyz`
4. `curl --noproxy '*' -u 'admin:HarborAdmin123!' http://harbor.192.168.0.108.nip.io:32668/api/v2.0/users/current`
5. `ssh root@192.168.0.108 'gitlab-runner verify'`

## 变更原则

- 不要直接改模板现有 `dev/`、`prod/` 通用文件去污染模板默认行为
- 优先在 `server/deploy/lab-ha/` 下追加实验文件
- 任何会显著增加资源占用的组件，先评估 `3 x 4C/8G` 上限
- 若要把 GitOps 真正闭环到 Argo CD，同步时要先明确：
  - 是否允许把 lab manifest 真正提交到 GitLab 仓库
  - 当前已切换到 Harbor 拉镜像，后续重点是让 GitLab 提交自动驱动 Argo CD 同步

## 已知实验室限制

- MetalLB VIP 对外部客户端不稳定，因此外部统一走 node2 NodePort
- GitLab 目前是单点宿主机服务，不是 HA GitLab
- Harbor 当前关闭 `trivy`
- Loki 当前为轻量单实例，不是分布式日志集群
