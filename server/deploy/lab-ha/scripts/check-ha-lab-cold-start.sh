#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
SSH_USER="${SSH_USER:-root}"
ACCESS_HOST="${ACCESS_HOST:-192.168.0.108}"
LAB_NODE_IPS_DEFAULT="192.168.0.7 192.168.0.108 192.168.0.128"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5)
SUMMARY_HELPER="${SCRIPT_DIR}/write-lab-ops-summary.sh"
STALE_POD_HELPER="${SCRIPT_DIR}/cleanup-stale-controlled-pods.sh"
AUTO_CLEANUP_STALE_PODS="${AUTO_CLEANUP_STALE_PODS:-true}"
STALE_POD_MIN_AGE_SECONDS="${STALE_POD_MIN_AGE_SECONDS:-300}"
STALE_POD_WAIT_SECONDS="${STALE_POD_WAIT_SECONDS:-25}"

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

fetch_url_code() {
	local url="$1"
	local code="000"
	local attempt

	# 冷启动尾巴里入口会有短暂 flap，做短重试避免把瞬时收敛误判成永久失败。
	for attempt in 1 2 3; do
		code="$(curl --noproxy '*' -k -L -o /dev/null -s -w '%{http_code}' --connect-timeout 5 --max-time 12 "$url" || true)"
		if [[ "$code" == "200" ]]; then
			break
		fi
		sleep 2
	done

	printf '%s' "$code"
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

if awk '!/^[[:space:]]*#/ && $3 == "swap" {exit 1}' /etc/fstab; then
	echo 'fstab_swap=commented'
else
	echo 'fstab_swap=present'
	exit 15
fi

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

if systemctl list-unit-files | grep -q '^firewalld\.service'; then
	firewalld_enabled="$(systemctl is-enabled firewalld 2>/dev/null || true)"
	firewalld_active="$(systemctl is-active firewalld 2>/dev/null || true)"
	[[ "$firewalld_enabled" != "enabled" && "$firewalld_active" != "active" ]] || {
		printf 'firewalld=%s/%s\n' "$firewalld_enabled" "$firewalld_active"
		exit 16
	}
fi
echo 'firewalld=off'

if command -v ufw >/dev/null 2>&1; then
	ufw_status="$(ufw status 2>/dev/null | sed -n '1p' || true)"
	ufw_enabled="$(systemctl is-enabled ufw 2>/dev/null || true)"
	[[ "$ufw_status" == "Status: inactive" && "$ufw_enabled" != "enabled" ]] || {
		printf 'ufw=%s/%s\n' "$ufw_enabled" "$ufw_status"
		exit 17
	}
fi
echo 'ufw=off'

if systemctl list-unit-files | grep -q '^multipathd\.service'; then
	multipathd_enabled="$(systemctl is-enabled multipathd.service 2>/dev/null || true)"
	multipathd_active="$(systemctl is-active multipathd.service 2>/dev/null || true)"
	multipathd_socket_enabled="$(systemctl is-enabled multipathd.socket 2>/dev/null || true)"
	multipathd_socket_active="$(systemctl is-active multipathd.socket 2>/dev/null || true)"
	case "$multipathd_enabled" in
		enabled|enabled-runtime)
			printf 'multipathd=%s/%s\n' "$multipathd_enabled" "$multipathd_active"
			exit 19
			;;
	esac
	case "$multipathd_socket_enabled" in
		enabled|enabled-runtime)
			printf 'multipathd.socket=%s/%s\n' "$multipathd_socket_enabled" "$multipathd_socket_active"
			exit 20
			;;
	esac
	[[ "$multipathd_active" != "active" && "$multipathd_socket_active" != "active" ]] || {
		printf 'multipathd_runtime=%s/%s\n' "$multipathd_active" "$multipathd_socket_active"
		exit 21
	}
fi
echo 'multipathd=off'

if command -v sestatus >/dev/null 2>&1; then
	selinux_state="$(sestatus | awk -F: '/SELinux status:/ {gsub(/^[[:space:]]+/, "", $2); print $2}')"
	selinux_mode="$(sestatus | awk -F: '/Current mode:/ {gsub(/^[[:space:]]+/, "", $2); print $2}')"
	if [[ "$selinux_state" == "enabled" && "$selinux_mode" == "enforcing" ]]; then
		printf 'selinux=%s/%s\n' "$selinux_state" "$selinux_mode"
		exit 18
	fi
	printf 'selinux=%s/%s\n' "${selinux_state:-unknown}" "${selinux_mode:-unknown}"
else
	echo 'selinux=absent'
fi
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

	local bad_pods cleanup_output cleanup_deleted
	bad_pods="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|CreateContainerError|Error|Pending|Unknown|Terminating' || true)"
	if [[ "$AUTO_CLEANUP_STALE_PODS" == "true" ]] && [[ -n "$bad_pods" ]] && printf '%s\n' "$bad_pods" | egrep -q 'Unknown|Terminating'; then
		printf 'stale_pod_cleanup=auto\n'
		if cleanup_output="$(MIN_AGE_SECONDS="$STALE_POD_MIN_AGE_SECONDS" KUBECONFIG="$KUBECONFIG" bash "$STALE_POD_HELPER" 2>&1)"; then
			printf '%s\n' "$cleanup_output"
			cleanup_deleted="$(printf '%s\n' "$cleanup_output" | awk -F= '/^deleted_count=/{print $2; exit}')"
			if [[ "${cleanup_deleted:-0}" -gt 0 ]]; then
				# 等 controller 把旧 Pod 对象清走并重建，避免把冷启动收敛尾巴误判成永久故障。
				sleep "$STALE_POD_WAIT_SECONDS"
				bad_pods="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get pods -A | egrep 'CrashLoopBackOff|ImagePullBackOff|CreateContainerError|Error|Pending|Unknown|Terminating' || true)"
			fi
		else
			printf '%s\n' "$cleanup_output" >&2
			record_failure 'stale controlled pod cleanup helper failed'
		fi
	fi
	if [[ -n "$bad_pods" ]]; then
		printf '%s\n' "$bad_pods"
		record_failure 'cluster still has unhealthy pods'
	else
		echo 'pods=no-critical-errors'
	fi
}

check_storage_ha_baseline() {
	printf '== storage ha baseline ==\n'

	local auto_salvage auto_delete node_down_policy
	local multipath_nodes faulted_volumes degraded_volumes schedulable_nodes
	auto_salvage="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get settings.longhorn.io -n longhorn-system auto-salvage -o jsonpath='{.value}' 2>/dev/null || true)"
	auto_delete="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get settings.longhorn.io -n longhorn-system auto-delete-pod-when-volume-detached-unexpectedly -o jsonpath='{.value}' 2>/dev/null || true)"
	node_down_policy="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get settings.longhorn.io -n longhorn-system node-down-pod-deletion-policy -o jsonpath='{.value}' 2>/dev/null || true)"
	multipath_nodes="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes.longhorn.io -n longhorn-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .status.conditions[?(@.type=="Multipathd")]}{.status}{"\n"}{end}{end}' 2>/dev/null | awk '$2 == "False" {print $1}' | paste -sd',' -)"
	faulted_volumes="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get volumes.longhorn.io -n longhorn-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.robustness}{"\n"}{end}' 2>/dev/null | awk '$2 == "faulted" {print $1}' | paste -sd',' -)"
	degraded_volumes="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get volumes.longhorn.io -n longhorn-system -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.robustness}{"\n"}{end}' 2>/dev/null | awk '$2 == "degraded" {print $1}' | paste -sd',' -)"
	if command -v jq >/dev/null 2>&1; then
		# Longhorn diskStatus 是 map 结构，直接用 jsonpath 很容易在不同版本下误判；这里统一走 jq 统计真实可调度磁盘数。
		schedulable_nodes="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get nodes.longhorn.io -n longhorn-system -o json 2>/dev/null | jq -r '[.items[] | (.status.diskStatus // {} | to_entries[]) | (.value.conditions // [])[] | select(.type == "Schedulable" and .status == "True")] | length' 2>/dev/null || true)"
	else
		record_failure 'jq not found; cannot verify longhorn schedulable storage nodes'
		schedulable_nodes="0"
	fi

	printf 'longhorn_auto_salvage=%s\n' "${auto_salvage:-unknown}"
	printf 'longhorn_auto_delete_detached_pod=%s\n' "${auto_delete:-unknown}"
	printf 'longhorn_node_down_pod_deletion_policy=%s\n' "${node_down_policy:-unknown}"
	printf 'longhorn_multipath_nodes=%s\n' "${multipath_nodes:-none}"
	printf 'longhorn_faulted_volumes=%s\n' "${faulted_volumes:-none}"
	printf 'longhorn_degraded_volumes=%s\n' "${degraded_volumes:-none}"
	printf 'longhorn_schedulable_nodes=%s\n' "${schedulable_nodes:-0}"

	[[ "$auto_salvage" == "true" ]] || record_failure 'longhorn auto-salvage is not enabled'
	[[ "$auto_delete" == "true" ]] || record_failure 'longhorn auto-delete-pod-when-volume-detached-unexpectedly is not enabled'
	[[ "$node_down_policy" == "delete-both-statefulset-and-deployment-pod" ]] || record_failure 'longhorn node-down-pod-deletion-policy is not production-ha baseline'
	[[ -z "$multipath_nodes" ]] || record_failure "longhorn nodes still report Multipathd issue: ${multipath_nodes}"
	[[ -z "$faulted_volumes" ]] || record_failure "longhorn still has faulted volumes: ${faulted_volumes}"
	# 当前默认卷副本数为 2；若少于 2 个 Longhorn 节点还能继续调度新副本，恢复后很容易长期停在 degraded。
	[[ "${schedulable_nodes:-0}" -ge 2 ]] || record_failure "longhorn only has ${schedulable_nodes:-0} schedulable storage nodes"
	if [[ -n "$degraded_volumes" ]]; then
		printf 'WARN: longhorn degraded volumes still present: %s\n' "$degraded_volumes" >&2
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
		code="$(fetch_url_code "$url")"
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
check_storage_ha_baseline
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
