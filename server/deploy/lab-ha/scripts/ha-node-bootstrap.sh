#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
	printf 'Usage: %s <new-hostname>\n' "$0" >&2
	exit 1
fi

NEW_HOSTNAME="$1"
ROOT_PASSWORD="${ROOT_PASSWORD:-123456}"
PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINvGvKbsg+kIQcpQNey1+O18hi11Bl5ZDb/+0HI5xr14 simon@simons-MacBook-Air.local'

if [[ $EUID -ne 0 ]]; then
	exec sudo -E bash "$0" "$@"
fi

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

printf '\nDone. Now tell Codex this node hostname is %s and provide the reachable IP shown above.\n' "$NEW_HOSTNAME"
