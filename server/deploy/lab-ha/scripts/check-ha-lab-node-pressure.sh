#!/usr/bin/env bash
set -euo pipefail

SSH_USER="${SSH_USER:-root}"
LAB_NODE_IPS_DEFAULT="192.168.0.7 192.168.0.108 192.168.0.128"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5)
STEAL_WARN_PERCENT="${STEAL_WARN_PERCENT:-5}"
IOWAIT_WARN_PERCENT="${IOWAIT_WARN_PERCENT:-5}"
VMSTAT_INTERVAL_SECONDS="${VMSTAT_INTERVAL_SECONDS:-1}"
VMSTAT_SAMPLES="${VMSTAT_SAMPLES:-2}"
ETCD_WARN_TAIL_LINES="${ETCD_WARN_TAIL_LINES:-1200}"

if [[ $# -gt 0 ]]; then
	NODE_IPS=("$@")
else
	IFS=' ' read -r -a NODE_IPS <<<"${LAB_NODE_IPS:-$LAB_NODE_IPS_DEFAULT}"
fi

warnings=()
failures=()

record_warning() {
	warnings+=("$1")
	printf 'WARN: %s\n' "$1" >&2
}

record_failure() {
	failures+=("$1")
	printf 'FAIL: %s\n' "$1" >&2
}

float_ge() {
	local left="$1"
	local right="$2"
	awk -v left="$left" -v right="$right" 'BEGIN { exit !((left + 0) >= (right + 0)) }'
}

check_node() {
	local host="$1"
	local output=""
	local node_name=""
	local steal=""
	local iowait=""
	local iostat_steal=""
	local iostat_iowait=""
	local etcd_warn_count=""
	local kernel_warn_count=""

	printf '== node %s ==\n' "$host"

	if ! output="$(
		ssh "${SSH_OPTS[@]}" "${SSH_USER}@${host}" 'bash -s' -- \
			"$VMSTAT_INTERVAL_SECONDS" \
			"$VMSTAT_SAMPLES" \
			"$ETCD_WARN_TAIL_LINES" <<'EOF'
set -euo pipefail

VMSTAT_INTERVAL_SECONDS="$1"
VMSTAT_SAMPLES="$2"
ETCD_WARN_TAIL_LINES="$3"

printf 'host=%s\n' "$(hostnamectl --static 2>/dev/null || hostname)"
printf 'load='
uptime | sed 's/.*load average: //'
printf 'mem='
free -h | awk 'NR==2 {print $3 "/" $2 " avail=" $7}'
printf 'disk='
df -h / | awk 'NR==2 {print $3 "/" $2 " used=" $5}'

if command -v vmstat >/dev/null 2>&1; then
	vm_line="$(vmstat "$VMSTAT_INTERVAL_SECONDS" "$VMSTAT_SAMPLES" | tail -n 1)"
	printf 'vmstat_us=%s\n' "$(awk '{print $(NF-4)}' <<<"$vm_line")"
	printf 'vmstat_sy=%s\n' "$(awk '{print $(NF-3)}' <<<"$vm_line")"
	printf 'vmstat_id=%s\n' "$(awk '{print $(NF-2)}' <<<"$vm_line")"
	printf 'vmstat_wa=%s\n' "$(awk '{print $(NF-1)}' <<<"$vm_line")"
	printf 'vmstat_st=%s\n' "$(awk '{print $NF}' <<<"$vm_line")"
else
	echo 'vmstat_missing=true'
fi

if command -v iostat >/dev/null 2>&1; then
	iostat_cpu_line="$(iostat "$VMSTAT_INTERVAL_SECONDS" "$VMSTAT_SAMPLES" | awk '/avg-cpu/ {getline; line=$0} END {gsub(/^[[:space:]]+/, "", line); print line}')"
	if [[ -n "$iostat_cpu_line" ]]; then
		printf 'iostat_us=%s\n' "$(awk '{print $1}' <<<"$iostat_cpu_line")"
		printf 'iostat_sy=%s\n' "$(awk '{print $3}' <<<"$iostat_cpu_line")"
		printf 'iostat_wa=%s\n' "$(awk '{print $4}' <<<"$iostat_cpu_line")"
		printf 'iostat_st=%s\n' "$(awk '{print $5}' <<<"$iostat_cpu_line")"
	fi
else
	echo 'iostat_missing=true'
fi

ETCD="$(crictl ps 2>/dev/null | awk '/ etcd / {print $1; exit}')"
if [[ -n "$ETCD" ]]; then
	etcd_warn_count="$(crictl logs --tail "$ETCD_WARN_TAIL_LINES" "$ETCD" 2>/dev/null | grep -Ec 'apply request took too long|leader failed to send out heartbeat|slow disk' || true)"
else
	etcd_warn_count="0"
fi
printf 'etcd_warn_count=%s\n' "$etcd_warn_count"

kernel_warn_count="$(dmesg -T 2>/dev/null | grep -Eic 'i/o error|blk_update_request|buffer i/o|task .* blocked for more than|timed out' || true)"
printf 'kernel_io_warn_count=%s\n' "$kernel_warn_count"

if [[ "$etcd_warn_count" != "0" ]]; then
	echo 'etcd_warn_tail:'
	crictl logs --tail "$ETCD_WARN_TAIL_LINES" "$ETCD" 2>/dev/null | grep -E 'apply request took too long|leader failed to send out heartbeat|slow disk' | tail -n 3 || true
fi

if [[ "$kernel_warn_count" != "0" ]]; then
	echo 'kernel_warn_tail:'
	dmesg -T 2>/dev/null | grep -Ei 'i/o error|blk_update_request|buffer i/o|task .* blocked for more than|timed out' | tail -n 3 || true
fi
EOF
	)"; then
		record_failure "${host} ssh_or_remote_check_failed"
		return
	fi

	printf '%s\n' "$output"

	node_name="$(awk -F= '/^host=/{print $2; exit}' <<<"$output")"
	steal="$(awk -F= '/^vmstat_st=/{print $2; exit}' <<<"$output")"
	iowait="$(awk -F= '/^vmstat_wa=/{print $2; exit}' <<<"$output")"
	iostat_steal="$(awk -F= '/^iostat_st=/{print $2; exit}' <<<"$output")"
	iostat_iowait="$(awk -F= '/^iostat_wa=/{print $2; exit}' <<<"$output")"
	etcd_warn_count="$(awk -F= '/^etcd_warn_count=/{print $2; exit}' <<<"$output")"
	kernel_warn_count="$(awk -F= '/^kernel_io_warn_count=/{print $2; exit}' <<<"$output")"

	if [[ -n "$steal" ]] && float_ge "$steal" "$STEAL_WARN_PERCENT"; then
		record_warning "${node_name:-$host} cpu_steal=${steal}% (threshold ${STEAL_WARN_PERCENT}%)"
	fi
	if [[ -n "$iowait" ]] && float_ge "$iowait" "$IOWAIT_WARN_PERCENT"; then
		record_warning "${node_name:-$host} io_wait=${iowait}% (threshold ${IOWAIT_WARN_PERCENT}%)"
	fi
	if [[ -n "$iostat_steal" ]] && float_ge "$iostat_steal" "$STEAL_WARN_PERCENT"; then
		record_warning "${node_name:-$host} cpu_steal_iostat=${iostat_steal}% (threshold ${STEAL_WARN_PERCENT}%)"
	fi
	if [[ -n "$iostat_iowait" ]] && float_ge "$iostat_iowait" "$IOWAIT_WARN_PERCENT"; then
		record_warning "${node_name:-$host} io_wait_iostat=${iostat_iowait}% (threshold ${IOWAIT_WARN_PERCENT}%)"
	fi
	if [[ -n "$etcd_warn_count" ]] && float_ge "$etcd_warn_count" "1"; then
		record_warning "${node_name:-$host} etcd_warn_count=${etcd_warn_count}"
	fi
	if [[ -n "$kernel_warn_count" ]] && float_ge "$kernel_warn_count" "1"; then
		record_warning "${node_name:-$host} kernel_io_warn_count=${kernel_warn_count}"
	fi

	echo
}

for host in "${NODE_IPS[@]}"; do
	check_node "$host"
done

if [[ ${#failures[@]} -gt 0 ]]; then
	printf 'NODE_PRESSURE_FAIL failures=%s warnings=%s\n' "${#failures[@]}" "${#warnings[@]}"
	exit 2
fi

if [[ ${#warnings[@]} -gt 0 ]]; then
	printf 'NODE_PRESSURE_WARN warnings=%s\n' "${#warnings[@]}"
	exit 1
fi

printf 'NODE_PRESSURE_OK nodes=%s\n' "${#NODE_IPS[@]}"
