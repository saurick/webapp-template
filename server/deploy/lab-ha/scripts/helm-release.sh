#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-/Users/simon/.kube/ha-lab.conf}"
OUTPUT_DIR="${ROOT_DIR}/artifacts/helm-rendered"
MODE="${1:-template}"
ONLY="${ONLY:-}"
SKIP_REPO_UPDATE="${SKIP_REPO_UPDATE:-0}"
HELM_TAKE_OWNERSHIP="${HELM_TAKE_OWNERSHIP:-0}"
HELM_FORCE_CONFLICTS="${HELM_FORCE_CONFLICTS:-0}"
HELM_TIMEOUT="${HELM_TIMEOUT:-120s}"

usage() {
  cat <<'EOF'
用法:
  bash server/deploy/lab-ha/scripts/helm-release.sh repos
  bash server/deploy/lab-ha/scripts/helm-release.sh template
  bash server/deploy/lab-ha/scripts/helm-release.sh apply
  bash server/deploy/lab-ha/scripts/helm-release.sh list

可选环境变量:
  ONLY=<release-name>       只处理单个 release
  KUBECONFIG_PATH=<path>    指定 kubeconfig，默认 /Users/simon/.kube/ha-lab.conf
  HELM_TIMEOUT=<duration>   Helm upgrade 超时，默认 120s
  HELM_TAKE_OWNERSHIP=1     仅用于一次性接管历史手工资源，给 Helm 加 --take-ownership
  HELM_FORCE_CONFLICTS=1    仅用于迁移旧 field manager，给 Helm 加 --force-conflicts
EOF
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'missing required tool: %s\n' "$1" >&2
    exit 1
  }
}

match_release() {
  local name="$1"
  [ -z "$ONLY" ] || [ "$ONLY" = "$name" ]
}

add_repos() {
  helm repo add cilium https://helm.cilium.io >/dev/null
  helm repo add metallb https://metallb.github.io/metallb >/dev/null
  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
  helm repo add jetstack https://charts.jetstack.io >/dev/null
  helm repo add longhorn https://charts.longhorn.io >/dev/null
  helm repo add cnpg https://cloudnative-pg.github.io/charts >/dev/null
  helm repo add seaweedfs https://seaweedfs.github.io/seaweedfs/helm >/dev/null
  helm repo add grafana https://grafana.github.io/helm-charts >/dev/null
  helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
  helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
  helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/ >/dev/null
  helm repo add bitnami-labs https://bitnami-labs.github.io/sealed-secrets >/dev/null
  helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts >/dev/null
  helm repo add argo https://argoproj.github.io/argo-helm >/dev/null
  helm repo add harbor https://helm.goharbor.io >/dev/null
  # 只更新 lab-ha 实际依赖的仓库，避免本机残留的无关 repo 让整套发布链路被环境噪音拖死。
  helm repo update \
    cilium metallb ingress-nginx jetstack longhorn cnpg seaweedfs grafana \
    prometheus-community metrics-server headlamp bitnami-labs vmware-tanzu argo harbor >/dev/null
}

need_repos() {
  if [ "$SKIP_REPO_UPDATE" = "1" ]; then
    return 1
  fi

  if [ "$MODE" = "template" ] && [ "$ONLY" = "lab-platform" ]; then
    return 1
  fi

  return 0
}

check_kube_api_stability() {
  [ "$MODE" = "apply" ] || return 0
  require_tool kubectl

  local attempt
  for attempt in 1 2 3; do
    # 先做短链路预检：当前现场真实问题不是 API 完全不可达，而是 list/read body 会偶发卡死。
    if kubectl --kubeconfig "$KUBECONFIG_PATH" --request-timeout=10s --disable-compression=true get --raw='/readyz' >/dev/null 2>&1 &&
      kubectl --kubeconfig "$KUBECONFIG_PATH" --request-timeout=10s --disable-compression=true get nodes -o name >/dev/null 2>&1; then
      return 0
    fi

    printf 'WARN: kubernetes API preflight failed (%s/3), retrying...\n' "$attempt" >&2
    sleep 2
  done

  printf 'Kubernetes API from this host is unstable; abort Helm apply before upgrade.\n' >&2
  return 1
}

sync_platform_raw() {
  local raw_dir="${ROOT_DIR}/charts/lab-platform/files/raw"
  mkdir -p "$raw_dir"
  rm -f "$raw_dir"/*.yaml

  local files=(
    alert-webhook-receiver.yaml
    app-pg-cluster.yaml
    argocd-repo-secret-sealed.yaml
    argocd-rollouts-metrics.yaml
    argocd-webapp-app.yaml
    argocd-webapp-prod-trial-app.yaml
    cnpg-podmonitor.yaml
    grafana-jaeger-datasource.yaml
    grafana-lab-data-services-dashboard.yaml
    grafana-lab-gitops-dashboard.yaml
    grafana-lab-loadtest-dashboard.yaml
    grafana-lab-loadtest-official-dashboard.yaml
    grafana-lab-overview-dashboard.yaml
    grafana-lab-postgres-backup-dashboard.yaml
    grafana-lab-service-governance-dashboard.yaml
    grafana-loki-datasource.yaml
    harbor-ui-proxy.yaml
    jaeger.yaml
    loki-standalone.yaml
    platform-ingresses.yaml
    platform-nodeports.yaml
    platform-portal.yaml
    prometheus-rule-service-governance.yaml
  )

  local file=""
  for file in "${files[@]}"; do
    cp "${ROOT_DIR}/manifests/${file}" "${raw_dir}/${file}"
  done
}

run_release() {
  local name="$1"
  local namespace="$2"
  local chart="$3"
  local version="$4"
  shift 4

  if ! match_release "$name"; then
    return 0
  fi

  local cmd=()

  case "$MODE" in
    template)
      mkdir -p "$OUTPUT_DIR"
      cmd=(helm template "$name" "$chart" --namespace "$namespace")
      if [ -n "$version" ]; then
        cmd+=(--version "$version")
      fi
      if [ "$#" -gt 0 ]; then
        cmd+=("$@")
      fi
      "${cmd[@]}" >"${OUTPUT_DIR}/${name}.yaml"
      ;;
    apply)
      cmd=(helm upgrade --install "$name" "$chart" --namespace "$namespace" --create-namespace --kubeconfig "$KUBECONFIG_PATH" --timeout "$HELM_TIMEOUT")
      # 只在一次性迁移历史手工对象时开启，避免把日常发布默默放宽成“无条件接管”。
      if [ "$HELM_TAKE_OWNERSHIP" = "1" ]; then
        cmd+=(--take-ownership)
      fi
      # 历史 client-side apply 与 Helm v4 server-side apply 首次交接时，允许一次性强制改写冲突字段。
      if [ "$HELM_FORCE_CONFLICTS" = "1" ]; then
        cmd+=(--force-conflicts)
      fi
      if [ -n "$version" ]; then
        cmd+=(--version "$version")
      fi
      if [ "$#" -gt 0 ]; then
        cmd+=("$@")
      fi
      # 先打印 release 名称和超时设置，避免现场再次看到“长时间无输出”却不知道卡在谁身上。
      printf 'Applying release %s in namespace %s (timeout=%s)\n' "$name" "$namespace" "$HELM_TIMEOUT"
      "${cmd[@]}"
      ;;
    list)
      printf '%s\t%s\t%s\t%s\n' "$name" "$namespace" "$chart" "${version:-local}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

restart_lab_platform_runtime_deployments() {
  [ "$MODE" = "apply" ] || return 0
  match_release lab-platform || return 0
  require_tool kubectl

  # receiver.py 来自 ConfigMap 挂载；只更新 ConfigMap 不会让已运行的 Python 进程自动重载新路由。
  if kubectl --kubeconfig "$KUBECONFIG_PATH" get deployment alert-webhook-receiver -n monitoring >/dev/null 2>&1; then
    kubectl --kubeconfig "$KUBECONFIG_PATH" rollout restart deployment/alert-webhook-receiver -n monitoring >/dev/null
    kubectl --kubeconfig "$KUBECONFIG_PATH" rollout status deployment/alert-webhook-receiver -n monitoring --timeout=180s
  fi
}

reconcile_longhorn_default_disk_reservation() {
  [ "$MODE" = "apply" ] || return 0
  match_release longhorn || return 0
  require_tool kubectl
  require_tool jq

  local reserved_percent
  reserved_percent="$(
    awk '
      $1 == "defaultSettings:" { in_default = 1; next }
      in_default && /^[^[:space:]]/ { in_default = 0 }
      in_default && $1 == "storageReservedPercentageForDefaultDisk:" { print $2; exit }
    ' "${ROOT_DIR}/manifests/longhorn-values.yaml"
  )"

  if [ -z "$reserved_percent" ]; then
    return 0
  fi

  [[ "$reserved_percent" =~ ^[0-9]+$ ]] || {
    printf 'invalid Longhorn storageReservedPercentageForDefaultDisk: %s\n' "$reserved_percent" >&2
    exit 1
  }

  # Longhorn 的默认盘保留比例只影响新建默认盘；这里把现有节点的 Node CR 一并收口到仓库口径。
  kubectl --kubeconfig "$KUBECONFIG_PATH" get nodes.longhorn.io -n longhorn-system -o json |
    jq -c --argjson reserved_percent "$reserved_percent" '
      .items[]
      | .metadata.name as $node
      | .spec.disks as $specDisks
      | .status.diskStatus as $statusDisks
      | $specDisks
      | to_entries[]
      | select(.value.path == "/var/lib/longhorn")
      | .key as $disk
      | .value.storageReserved as $current
      | ($statusDisks[$disk].storageMaximum // 0) as $maximum
      | select($maximum > 0)
      | {
          node: $node,
          disk: $disk,
          current: $current,
          target: (($maximum * $reserved_percent) / 100 | floor)
        }
    ' |
    while IFS= read -r item; do
      [ -n "$item" ] || continue

      local node disk current target patch
      node="$(printf '%s' "$item" | jq -r '.node')"
      disk="$(printf '%s' "$item" | jq -r '.disk')"
      current="$(printf '%s' "$item" | jq -r '.current')"
      target="$(printf '%s' "$item" | jq -r '.target')"

      if [ "$current" = "$target" ]; then
        continue
      fi

      printf '==> reconcile longhorn disk reservation: %s/%s %s -> %s\n' "$node" "$disk" "$current" "$target"
      patch="$(jq -nc --arg disk "$disk" --argjson target "$target" '{spec:{disks:{($disk):{storageReserved:$target}}}}')"
      kubectl --kubeconfig "$KUBECONFIG_PATH" patch node.longhorn.io -n longhorn-system "$node" --type=merge -p "$patch" >/dev/null
    done
}

main() {
  require_tool helm
  require_tool cp

  case "$MODE" in
    repos|template|apply|list) ;;
    *)
      usage
      exit 1
      ;;
  esac

  sync_platform_raw

  if [ "$MODE" = "repos" ]; then
    add_repos
  elif { [ "$MODE" = "template" ] || [ "$MODE" = "apply" ]; } && need_repos; then
    add_repos
  fi

  if [ "$MODE" = "repos" ]; then
    exit 0
  fi

  check_kube_api_stability

  run_release cilium kube-system cilium/cilium 1.17.6 \
    -f "${ROOT_DIR}/manifests/cilium-values.yaml"
  run_release metallb metallb-system metallb/metallb 0.14.9
  run_release ingress-nginx ingress-nginx ingress-nginx/ingress-nginx 4.12.2 \
    -f "${ROOT_DIR}/manifests/ingress-nginx-values.yaml"
  run_release cert-manager cert-manager jetstack/cert-manager v1.17.1 \
    -f "${ROOT_DIR}/manifests/cert-manager-values.yaml"
  run_release metrics-server kube-system metrics-server/metrics-server 3.13.0 \
    -f "${ROOT_DIR}/manifests/metrics-server-values.yaml"
  run_release headlamp headlamp "${ROOT_DIR}/charts/headlamp" "" \
    -f "${ROOT_DIR}/manifests/headlamp-values.yaml"
  run_release longhorn longhorn-system longhorn/longhorn 1.8.1 \
    -f "${ROOT_DIR}/manifests/longhorn-values.yaml"
  reconcile_longhorn_default_disk_reservation
  run_release cnpg cnpg-system cnpg/cloudnative-pg 0.23.2
  run_release seaweedfs object-storage seaweedfs/seaweedfs 4.17.0 \
    -f "${ROOT_DIR}/manifests/seaweedfs-values.yaml"
  run_release kube-prometheus-stack monitoring prometheus-community/kube-prometheus-stack 69.8.2 \
    -f "${ROOT_DIR}/manifests/kube-prometheus-stack-values.yaml" \
    -f "${ROOT_DIR}/manifests/alertmanager-values.yaml"
  run_release blackbox-exporter monitoring prometheus-community/prometheus-blackbox-exporter 9.2.0 \
    -f "${ROOT_DIR}/manifests/blackbox-values.yaml"
  run_release sealed-secrets sealed-secrets bitnami-labs/sealed-secrets 2.18.4 \
    -f "${ROOT_DIR}/manifests/sealed-secrets-values.yaml"
  run_release velero velero vmware-tanzu/velero 12.0.0 \
    -f "${ROOT_DIR}/manifests/velero-values.yaml"
  run_release promtail logging grafana/promtail 6.16.6 \
    -f "${ROOT_DIR}/manifests/promtail-values.yaml"
  run_release argo-cd argocd argo/argo-cd 7.7.16 \
    -f "${ROOT_DIR}/manifests/argo-cd-values.yaml"
  run_release argo-rollouts argo-rollouts argo/argo-rollouts 2.39.5
  run_release harbor harbor harbor/harbor 1.16.2 \
    -f "${ROOT_DIR}/manifests/harbor-values.yaml"
  run_release lab-platform lab-system "${ROOT_DIR}/charts/lab-platform" ""
  restart_lab_platform_runtime_deployments
}

main "$@"
