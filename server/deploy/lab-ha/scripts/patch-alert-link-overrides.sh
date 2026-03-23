#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG_PATH="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
NAMESPACE="${NAMESPACE:-monitoring}"

DASHBOARD_URL="http://192.168.0.108:30081/d/lab-ha-overview/ha-lab-ops-overview"
RUNBOOK_URL="http://192.168.0.108:8929/root/webapp-template-lab/-/blob/master/server/deploy/lab-ha/docs/TROUBLESHOOTING.md"
ALERTMANAGER_URL="http://192.168.0.108:30093/#/alerts"

patch_rule() {
  local resource="$1"
  local group="$2"
  local alert="$3"

  # 统一给高频值班告警补本地 dashboard/runbook 链接，同时保留官方 runbook 作为兜底参考。
  kubectl --kubeconfig "$KUBECONFIG_PATH" -n "$NAMESPACE" get prometheusrule "$resource" -o json |
    jq \
      --arg group "$group" \
      --arg alert "$alert" \
      --arg dashboard "$DASHBOARD_URL" \
      --arg runbook "$RUNBOOK_URL" \
      --arg alertmanager "$ALERTMANAGER_URL" '
      (.spec.groups[] | select(.name == $group).rules[] | select(.alert == $alert).annotations.upstream_runbook_url) =
        ((.spec.groups[] | select(.name == $group).rules[] | select(.alert == $alert).annotations.runbook_url) // "")
      |
      (.spec.groups[] | select(.name == $group).rules[] | select(.alert == $alert).annotations.runbook_url) = $runbook
      |
      (.spec.groups[] | select(.name == $group).rules[] | select(.alert == $alert).annotations.dashboard_url) = $dashboard
      |
      (.spec.groups[] | select(.name == $group).rules[] | select(.alert == $alert).annotations.alertmanager_url) = $alertmanager
      |
      (.spec.groups[] | select(.name == $group).rules[] | select(.alert == $alert).annotations.local_note) =
        "实验室值班优先看 dashboard_url，再按 runbook_url 排查；upstream_runbook_url 保留官方说明。"
    ' |
    kubectl --kubeconfig "$KUBECONFIG_PATH" apply -f -
}

patch_rule "kube-prometheus-stack-general.rules" "general.rules" "TargetDown"
patch_rule "kube-prometheus-stack-kubernetes-system-kube-proxy" "kubernetes-system-kube-proxy" "KubeProxyDown"
patch_rule "kube-prometheus-stack-kubernetes-system-scheduler" "kubernetes-system-scheduler" "KubeSchedulerDown"
patch_rule "kube-prometheus-stack-kubernetes-system-controller-manager" "kubernetes-system-controller-manager" "KubeControllerManagerDown"

echo "patched alert links for TargetDown / KubeProxyDown / KubeSchedulerDown / KubeControllerManagerDown"
