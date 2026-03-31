#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
	printf 'Usage: STATIC_IPV4=<ip/cidr> DEFAULT_GATEWAY_IPV4=<gateway> [DNS_IPV4S=ip1,ip2] [NETWORK_IFACE=eth0] %s <new-hostname>\n' "$0" >&2
	exit 1
fi

NEW_HOSTNAME="$1"
ROOT_PASSWORD="${ROOT_PASSWORD:-123456}"
SKIP_APT="${SKIP_APT:-0}"
STATIC_IPV4="${STATIC_IPV4:-}"
DEFAULT_GATEWAY_IPV4="${DEFAULT_GATEWAY_IPV4:-}"
DNS_IPV4S="${DNS_IPV4S:-}"
NETWORK_IFACE="${NETWORK_IFACE:-}"
PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINvGvKbsg+kIQcpQNey1+O18hi11Bl5ZDb/+0HI5xr14 simon@simons-MacBook-Air.local'
BASELINE_PACKAGES=(
	curl
	wget
	vim
	jq
	socat
	conntrack
	ebtables
	ethtool
	nfs-common
	open-iscsi
)
BASELINE_MODULES=(overlay br_netfilter iscsi_tcp)

if [[ $EUID -ne 0 ]]; then
	exec sudo -E bash "$0" "$@"
fi

detect_default_iface() {
	ip route show default 2>/dev/null | awk '/default/ {print $5; exit}'
}

configure_static_ipv4_if_requested() {
	if [[ -z "$STATIC_IPV4" ]]; then
		printf '==> skip static IPv4 config because STATIC_IPV4 is empty\n'
		return
	fi

	local iface gateway dns_csv backup_file
	iface="${NETWORK_IFACE:-$(detect_default_iface)}"
	gateway="${DEFAULT_GATEWAY_IPV4:-}"
	dns_csv="${DNS_IPV4S:-$gateway}"

	if [[ -z "$iface" ]]; then
		printf 'ERROR: failed to detect default network interface, set NETWORK_IFACE manually\n' >&2
		exit 2
	fi
	if [[ -z "$gateway" ]]; then
		printf 'ERROR: STATIC_IPV4 is set but DEFAULT_GATEWAY_IPV4 is empty\n' >&2
		exit 3
	fi

	printf '==> persist static IPv4 %s on %s\n' "$STATIC_IPV4" "$iface"
	# 当前入口节点和 kubeadm/etcd 广告地址依赖稳定节点 IP，继续走 DHCP 会在 reboot 后把入口和控制面一起漂坏。
	backup_file="/etc/netplan/50-cloud-init.yaml.bak.$(date +%Y%m%d%H%M%S)"
	if [[ -f /etc/netplan/50-cloud-init.yaml ]]; then
		cp /etc/netplan/50-cloud-init.yaml "$backup_file"
	fi
	mkdir -p /etc/netplan
	{
		printf 'network:\n'
		printf '  version: 2\n'
		printf '  ethernets:\n'
		printf '    %s:\n' "$iface"
		printf '      dhcp4: false\n'
		printf '      dhcp6: false\n'
		printf '      addresses:\n'
		printf '        - %s\n' "$STATIC_IPV4"
		printf '      routes:\n'
		printf '        - to: default\n'
		printf '          via: %s\n' "$gateway"
		printf '      nameservers:\n'
		printf '        addresses:\n'
		IFS=',' read -r -a dns_list <<<"$dns_csv"
		for dns_ip in "${dns_list[@]}"; do
			dns_ip="${dns_ip//[[:space:]]/}"
			[[ -n "$dns_ip" ]] || continue
			printf '          - %s\n' "$dns_ip"
		done
	} >/etc/netplan/50-cloud-init.yaml
	netplan generate
	netplan apply
}

install_baseline_packages() {
	if [[ "$SKIP_APT" == "1" ]]; then
		printf '==> skip apt package install because SKIP_APT=1\n'
		return
	fi

	printf '==> install baseline packages\n'
	export DEBIAN_FRONTEND=noninteractive
	apt-get update
	apt-get install -y --no-install-recommends "${BASELINE_PACKAGES[@]}"
}

disable_swap_persistently() {
	printf '==> disable swap now and persist across reboot\n'
	swapoff -a || true

	# 保证 kubelet 在节点重启后仍满足 kubeadm 基线，避免 swap 恢复导致整集群起不来。
	local tmp_fstab
	tmp_fstab="$(mktemp)"
	awk '
		/^[[:space:]]*#/ { print; next }
		$3 == "swap" { print "# " $0; next }
		{ print }
	' /etc/fstab >"$tmp_fstab"
	cat "$tmp_fstab" >/etc/fstab
	rm -f "$tmp_fstab"
}

disable_host_firewalls() {
	printf '==> disable host firewall baseline\n'

	# 当前 lab-ha 依赖 Cilium、NodePort、Longhorn 与多组件固定端口；在没有单独维护主机防火墙端口矩阵前，默认不保留模糊态。
	if command -v ufw >/dev/null 2>&1; then
		ufw disable || true
	fi
	if systemctl list-unit-files | grep -q '^ufw\.service'; then
		systemctl disable --now ufw || true
	fi
	if systemctl list-unit-files | grep -q '^firewalld\.service'; then
		systemctl disable --now firewalld || true
	fi
}

disable_multipathd() {
	printf '==> disable multipathd baseline for longhorn nodes\n'

	# Longhorn 官方将运行中的 multipathd 标为已知问题；当前节点未承载独立 SAN，多路径默认不保留。
	if systemctl list-unit-files | grep -q '^multipathd\.service'; then
		systemctl disable --now multipathd.service multipathd.socket || true
		systemctl mask multipathd.service multipathd.socket || true
	fi
}

configure_kernel_modules() {
	printf '==> configure kernel modules for k8s + storage baseline\n'
	mkdir -p /etc/modules-load.d
	printf '%s\n' "${BASELINE_MODULES[@]}" >/etc/modules-load.d/k8s-ha-lab.conf
	for module in "${BASELINE_MODULES[@]}"; do
		modprobe "$module"
	done
}

configure_sysctl_baseline() {
	printf '==> configure sysctl baseline\n'
	cat >/etc/sysctl.d/99-k8s-ha-lab.conf <<'EOF'
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
vm.max_map_count = 262144
fs.inotify.max_user_instances = 8192
fs.inotify.max_user_watches = 1048576
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
net.ipv6.conf.lo.disable_ipv6 = 1
EOF
	sysctl --system >/dev/null
}

enable_storage_services() {
	printf '==> ensure storage prerequisites enabled\n'
	if systemctl list-unit-files | grep -q '^iscsid\.service'; then
		systemctl enable --now iscsid
	fi
	if systemctl list-unit-files | grep -q '^open-iscsi\.service'; then
		systemctl enable --now open-iscsi
	fi
}

print_baseline_summary() {
	printf '==> baseline summary\n'
	printf 'hostname=%s\n' "$(hostnamectl --static)"
	printf 'swap:\n'
	swapon --show || true
	printf 'fstab-swap:\n'
	grep -nE 'swap|swap\.img' /etc/fstab || true
	printf 'modules:\n'
	lsmod | egrep '^(overlay|br_netfilter|iscsi_tcp)' || true
	printf 'sysctl:\n'
	sysctl -n \
		net.bridge.bridge-nf-call-iptables \
		net.bridge.bridge-nf-call-ip6tables \
		net.ipv4.ip_forward \
		vm.max_map_count \
		fs.inotify.max_user_instances \
		fs.inotify.max_user_watches
	printf 'services:\n'
	printf 'kubelet=%s\n' "$(systemctl is-active kubelet 2>/dev/null || echo inactive)"
	printf 'containerd=%s\n' "$(systemctl is-active containerd 2>/dev/null || echo inactive)"
	printf 'iscsid=%s\n' "$(systemctl is-active iscsid 2>/dev/null || echo inactive)"
	if command -v ufw >/dev/null 2>&1; then
		printf 'ufw=%s\n' "$(ufw status | sed -n '1p' 2>/dev/null || echo unknown)"
	fi
	if systemctl list-unit-files | grep -q '^firewalld\.service'; then
		printf 'firewalld=%s\n' "$(systemctl is-active firewalld 2>/dev/null || echo inactive)"
	fi
	if systemctl list-unit-files | grep -q '^multipathd\.service'; then
		printf 'multipathd=%s/%s\n' \
			"$(systemctl is-enabled multipathd.service 2>/dev/null || echo unknown)" \
			"$(systemctl is-active multipathd.service 2>/dev/null || echo inactive)"
		printf 'multipathd.socket=%s/%s\n' \
			"$(systemctl is-enabled multipathd.socket 2>/dev/null || echo unknown)" \
			"$(systemctl is-active multipathd.socket 2>/dev/null || echo inactive)"
	fi
	printf 'ipv6_disable=%s/%s/%s\n' \
		"$(sysctl -n net.ipv6.conf.all.disable_ipv6 2>/dev/null || echo unknown)" \
		"$(sysctl -n net.ipv6.conf.default.disable_ipv6 2>/dev/null || echo unknown)" \
		"$(sysctl -n net.ipv6.conf.lo.disable_ipv6 2>/dev/null || echo unknown)"
}

printf '==> set hostname to %s\n' "$NEW_HOSTNAME"
hostnamectl set-hostname "$NEW_HOSTNAME"
if grep -q '^127.0.1.1' /etc/hosts 2>/dev/null; then
	sed -i.bak "s/^127\.0\.1\.1.*/127.0.1.1 ${NEW_HOSTNAME}/" /etc/hosts
else
	printf '127.0.1.1 %s\n' "$NEW_HOSTNAME" >>/etc/hosts
fi

printf '==> regenerate machine-id for cloned VM uniqueness\n'
rm -f /var/lib/dbus/machine-id
truncate -s 0 /etc/machine-id
systemd-machine-id-setup
cp /etc/machine-id /var/lib/dbus/machine-id

configure_static_ipv4_if_requested
install_baseline_packages
disable_swap_persistently
disable_host_firewalls
disable_multipathd
configure_kernel_modules
configure_sysctl_baseline
enable_storage_services

printf '==> install SSH public key for root\n'
mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
grep -qxF "$PUBKEY" /root/.ssh/authorized_keys || printf '%s\n' "$PUBKEY" >>/root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

printf '==> set root password for local fallback\n'
printf 'root:%s\n' "$ROOT_PASSWORD" | chpasswd

printf '==> allow root SSH with key only\n'
mkdir -p /etc/ssh/sshd_config.d
cat >/etc/ssh/sshd_config.d/99-root-key-login.conf <<'EOF'
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PasswordAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
EOF

printf '==> regenerate SSH host keys for cloned VM uniqueness\n'
rm -f /etc/ssh/ssh_host_*key /etc/ssh/ssh_host_*key.pub
ssh-keygen -A

printf '==> ensure ssh service enabled\n'
if systemctl list-unit-files | grep -q '^ssh\.service'; then
	systemctl enable --now ssh
	systemctl restart ssh
else
	systemctl enable --now sshd
	systemctl restart sshd
fi

printf '==> current addresses\n'
ip -brief addr
print_baseline_summary

printf '\nDone. Now tell Codex this node hostname is %s and provide the reachable IP shown above.\n' "$NEW_HOSTNAME"
