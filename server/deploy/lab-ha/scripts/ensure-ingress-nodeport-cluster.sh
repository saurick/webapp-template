#!/usr/bin/env bash
set -euo pipefail

# 当前管理机经 VPN / 子网路由访问实验室网段时，
# 让 NodePort 走 Cluster 策略可以避免“节点还活着但本机没有 ingress pod”导致入口抖动。
KUBECONFIG_PATH="${KUBECONFIG_PATH:-/Users/simon/.kube/ha-lab.conf}"
NAMESPACE="${NAMESPACE:-ingress-nginx}"
SERVICE_NAME="${SERVICE_NAME:-ingress-nginx-controller}"

kubectl --kubeconfig "$KUBECONFIG_PATH" -n "$NAMESPACE" \
	patch svc "$SERVICE_NAME" \
	--type merge \
	-p '{"spec":{"externalTrafficPolicy":"Cluster"}}'

kubectl --kubeconfig "$KUBECONFIG_PATH" -n "$NAMESPACE" \
	get svc "$SERVICE_NAME" -o wide
