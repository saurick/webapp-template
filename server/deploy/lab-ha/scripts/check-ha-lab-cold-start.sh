#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
SSH_USER="${SSH_USER:-root}"
ACCESS_HOST="${ACCESS_HOST:-192.168.0.108}"
LAB_NODE_IPS_DEFAULT="192.168.0.7 192.168.0.108 192.168.0.128"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5)
SUMMARY_HELPER="${SCRIPT_DIR}/write-lab-ops-summary.sh"

if [[ $# -gt 0 ]]; then
	NODE_IPS=("$@")
else
	IFS=' ' read -r -a NODE_IPS <<<"${LAB_NODE_IPS:-$LAB_NODE_IPS_DEFAULT}"
fi

ACCESS_URLS=(
	"http://${ACCESS_HOST}:30088/"
	"http://${ACCESS_HOST}:32668/readyz"
	"http://${ACCESS_HOST}:30081/login"
	"http://${ACCESS_HOST}:30090/-/ready"
	"http://${ACCESS_HOST}:30093/"
	"https://${ACCESS_HOST}:30443/"
)

failures=()
K8S_READY_NODES=0
K8S_TOTAL_NODES=0
ARGO_SYNC_STATUS="unknown"
ARGO_HEALTH_STATUS="unknown"
BSL_PHASE="unknown"
ACCESS_OK_COUNT=0

record_failure() {
	failures+=("$1")
	printf 'FAIL: %s\n' "$1" >&2
}

persist_summary() {
	if ! command -v jq >/dev/null 2>&1; then
		printf 'WARN: jq not found, skip portal cold-start summary update\n' >&2
		return 0
	fi

	local status summary detail
	status="ok"
	if [[ ${#failures[@]} -gt 0 ]]; then
		status="fail"
	fi
	summary="nodes ${K8S_READY_NODES}/${K8S_TOTAL_NODES} · urls ${ACCESS_OK_COUNT}/${#ACCESS_URLS[@]} · argo ${ARGO_SYNC_STATUS}/${ARGO_HEALTH_STATUS} · bsl ${BSL_PHASE}"
	detail="checked ${#NODE_IPS[@]} nodes"
	if [[ ${#failures[@]} -gt 0 ]]; then
		detail="${detail} · issues $(printf '%s; ' "${failures[@]}")"
		detail="${detail%; }"
	fi

	jq -n \
		--arg kind "cold-start" \
		--arg status "$status" \
		--arg checked_at "$(date -u +%FT%TZ)" \
		--arg summary "$summary" \
		--arg detail "$detail" \
		--arg ready_nodes "$K8S_READY_NODES" \
		--arg total_nodes "$K8S_TOTAL_NODES" \
		--arg access_ok "$ACCESS_OK_COUNT" \
		--arg access_total "${#ACCESS_URLS[@]}" \
		--arg argo_sync "$ARGO_SYNC_STATUS" \
		--arg argo_health "$ARGO_HEALTH_STATUS" \
		--arg bsl_phase "$BSL_PHASE" \
		'{
			kind: $kind,
			status: $status,
			checked_at: $checked_at,
			summary: $summary,
			detail: $detail,
			metrics: {
				ready_nodes: $ready_nodes,
				total_nodes: $total_nodes,
				access_ok: $access_ok,
				access_total: $access_total,
				argo_sync: $argo_sync,
				argo_health: $argo_health,
				bsl_phase: $bsl_phase
			}
		}' | bash "$SUMMARY_HELPER" cold-start >/dev/null || true
}

check_node_baseline() {
	local host="$1"
	printf '== node %s ==\n' "$host"

	if ! ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" 'bash -s' <<'EOF'
set -euo pipefail

required_modules=(overlay br_netfilter iscsi_tcp)
required_sysctls=(
	net.bridge.bridge-nf-call-iptables=1
	net.bridge.bridge-nf-call-ip6tables=1
	net.ipv4.ip_forward=1
	vm.max_map_count=262144
	fs.inotify.max_user_instances=8192
	fs.inotify.max_user_watches=1048576
)

printf 'host=%s\n' "$(hostnamectl --static)"
if swapon --show --noheadings 2>/dev/null | grep -q .; then
	echo 'swap=enabled'
	exit 10
fi
echo 'swap=off'

systemctl is-active --quiet kubelet || {
	printf 'kubelet=%s\n' "$(systemctl is-active kubelet 2>/dev/null || echo inactive)"
	exit 11
}
echo 'kubelet=active'

systemctl is-active --quiet containerd || {
	printf 'containerd=%s\n' "$(systemctl is-active containerd 2>/dev/null || echo inactive)"
	exit 12
}
echo 'containerd=active'

for module in "${required_modules[@]}"; do
	lsmod | awk '{print $1}' | grep -qx "$module" || {
		printf 'missing_module=%s\n' "$module"
		exit 13
	}
done
echo 'modules=ok'

for pair in "${required_sysctls[@]}"; do
	key="${pair%=*}"
	expected="${pair#*=}"
	actual="$(sysctl -n "$key" 2>/dev/null || true)"
	[[ "$actual" == "$expected" ]] || {
		printf 'sysctl_mismatch=%s:%s\n' "$key" "$actual"
		exit 14
	}
done
echo 'sysctl=ok'
EOF
	then
		record_failure "node ${host} baseline not ready"
	fi
}

check_kubernetes() {
	printf '== kubernetes ==\n'
	if ! kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes -o wide; then
		record_failure 'kubectl get nodes failed'
		return
	fi

	K8S_TOTAL_NODES="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes --no-headers 2>/dev/null | wc -l | tr -d ' ')"
	K8S_READY_NODES="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes --no-headers 2>/dev/null | awk '$2 == "Ready" {count++} END {print count+0}')"

	if kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes --no-headers | awk '$2 != "Ready" {exit 1}'; then
		echo 'nodes=all-ready'
	else
		record_failure 'not all nodes are Ready'
	fi

	local bad_pods
	bad_pods="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|CreateContainerError|Error|Pending|Unknown|Terminating' || true)"
	if [[ -n "$bad_pods" ]]; then
		printf '%s\n' "$bad_pods"
		record_failure 'cluster still has unhealthy pods'
	else
		echo 'pods=no-critical-errors'
	fi
}

check_gitops_and_backup() {
	printf '== gitops and backup ==\n'
	local argo_status
	argo_status="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get application -n argocd webapp-template-lab -o jsonpath='{.status.sync.status} {.status.health.status}{"\n"}' 2>/dev/null || true)"
	if [[ -z "$argo_status" ]]; then
		record_failure 'argocd application check failed'
	else
		printf '%s\n' "$argo_status"
		ARGO_SYNC_STATUS="$(printf '%s' "$argo_status" | awk '{print $1}')"
		ARGO_HEALTH_STATUS="$(printf '%s' "$argo_status" | awk '{print $2}')"
	fi

	local bsl
	bsl="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get backupstoragelocation -n velero -o jsonpath='{range .items[*]}{.metadata.name}={.status.phase}{"\n"}{end}' 2>/dev/null || true)"
	if [[ -z "$bsl" ]]; then
		record_failure 'velero backup storage location check failed'
	else
		printf '%s\n' "$bsl"
		BSL_PHASE="$(printf '%s' "$bsl" | awk -F= 'NR==1 {print $2}')"
		printf '%s' "$bsl" | grep -q '=Available' || record_failure 'velero backup storage is not Available'
	fi
}

check_access_urls() {
	printf '== access urls ==\n'
	local url code
	for url in "${ACCESS_URLS[@]}"; do
		code="$(curl --noproxy '*' -k -L -o /dev/null -s -w '%{http_code}' --connect-timeout 5 --max-time 12 "$url" || true)"
		printf '%s -> %s\n' "$url" "$code"
		if [[ "$code" == "200" ]]; then
			ACCESS_OK_COUNT=$((ACCESS_OK_COUNT + 1))
		else
			record_failure "unexpected status for $url: $code"
		fi
	done
}

# 先抓节点 reboot-safe 基线，再看集群与入口，避免只看到 503 却漏掉 swap / kubelet 根因。
for host in "${NODE_IPS[@]}"; do
	check_node_baseline "$host"
done

check_kubernetes
check_gitops_and_backup
check_access_urls
persist_summary

if [[ ${#failures[@]} -gt 0 ]]; then
	printf '\nCold-start check failed with %d issue(s):\n' "${#failures[@]}" >&2
	for item in "${failures[@]}"; do
		printf -- '- %s\n' "$item" >&2
	done
	exit 1
fi

printf '\nCold-start check passed.\n'
