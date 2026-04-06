#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'EOF'
用法:
  TAILSCALE_AUTH_KEY=tskey-... \
    bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh

或:
  TAILSCALE_AUTH_KEY_FILE=~/.config/tailscale/lab-ha-router.key \
    bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/configure-tailscale-ops-host.sh

可选环境变量:
  ROUTER_HOST=root@192.168.0.108
  ROUTER_PORT=22
  SSH_STRICT_HOSTKEY_CHECKING=no
  TAILSCALE_HOSTNAME=lab-ha-router
  TAILSCALE_ROUTES=
  TAILSCALE_ADVERTISE_TAGS=tag:lab-ha-router
  TAILSCALE_ADVERTISE_TAGS=''   # 当前 auth key 若未获 tag owner 授权，可显式禁用 tag
  TAILSCALE_SSH=true
  TAILSCALE_ACCEPT_DNS=false
  TAILSCALE_LOGIN_SERVER=
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	usage
	exit 0
fi

require_tool() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'missing required tool: %s\n' "$1" >&2
		exit 1
	}
}

require_tool ssh

if [[ -n "${TAILSCALE_AUTH_KEY:-}" && -n "${TAILSCALE_AUTH_KEY_FILE:-}" ]]; then
	printf 'only one of TAILSCALE_AUTH_KEY or TAILSCALE_AUTH_KEY_FILE may be set\n' >&2
	exit 1
fi

if [[ -n "${TAILSCALE_AUTH_KEY_FILE:-}" ]]; then
	if [[ ! -f "${TAILSCALE_AUTH_KEY_FILE}" ]]; then
		printf 'tailscale auth key file not found: %s\n' "${TAILSCALE_AUTH_KEY_FILE}" >&2
		exit 1
	fi
	TAILSCALE_AUTH_KEY="$(tr -d '\r\n' <"${TAILSCALE_AUTH_KEY_FILE}")"
fi

if [[ -z "${TAILSCALE_AUTH_KEY:-}" ]]; then
	printf 'missing TAILSCALE_AUTH_KEY or TAILSCALE_AUTH_KEY_FILE\n' >&2
	exit 1
fi

router_host="${ROUTER_HOST:-root@192.168.0.108}"
router_port="${ROUTER_PORT:-22}"
ssh_strict_hostkey_checking="${SSH_STRICT_HOSTKEY_CHECKING:-no}"
tailscale_hostname="${TAILSCALE_HOSTNAME:-lab-ha-router}"
tailscale_routes="${TAILSCALE_ROUTES:-}"
tailscale_advertise_tags="${TAILSCALE_ADVERTISE_TAGS-tag:lab-ha-router}"
tailscale_ssh="${TAILSCALE_SSH:-true}"
tailscale_accept_dns="${TAILSCALE_ACCEPT_DNS:-false}"
tailscale_login_server="${TAILSCALE_LOGIN_SERVER:-}"

ssh_opts=(
	-p "${router_port}"
	-o "StrictHostKeyChecking=${ssh_strict_hostkey_checking}"
)

printf '==> bootstrap tailscale ops host on %s\n' "${router_host}"

{
	printf 'TAILSCALE_AUTH_KEY=%q\n' "${TAILSCALE_AUTH_KEY}"
	printf 'TAILSCALE_HOSTNAME=%q\n' "${tailscale_hostname}"
	printf 'TAILSCALE_ROUTES=%q\n' "${tailscale_routes}"
	printf 'TAILSCALE_ADVERTISE_TAGS=%q\n' "${tailscale_advertise_tags}"
	printf 'TAILSCALE_SSH=%q\n' "${tailscale_ssh}"
	printf 'TAILSCALE_ACCEPT_DNS=%q\n' "${tailscale_accept_dns}"
	printf 'TAILSCALE_LOGIN_SERVER=%q\n' "${tailscale_login_server}"
	cat <<'EOF'
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
	printf 'this script must run as root on the router host\n' >&2
	exit 1
fi

if [[ ! -r /etc/os-release ]]; then
	printf 'missing /etc/os-release on router host\n' >&2
	exit 1
fi

. /etc/os-release

case "${ID:-}" in
ubuntu | debian) ;;
*)
	printf 'unsupported router host OS: %s\n' "${ID:-unknown}" >&2
	exit 1
	;;
esac

if [[ -z "${VERSION_CODENAME:-}" ]]; then
	printf 'missing VERSION_CODENAME in /etc/os-release\n' >&2
	exit 1
fi

if ! command -v tailscale >/dev/null 2>&1 || ! command -v tailscaled >/dev/null 2>&1; then
	printf '==> install tailscale packages for %s/%s\n' "${ID}" "${VERSION_CODENAME}"
	apt-get update
	DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg
	install -d -m 0755 /usr/share/keyrings
	curl -fsSL "https://pkgs.tailscale.com/stable/${ID}/${VERSION_CODENAME}.noarmor.gpg" \
		-o /usr/share/keyrings/tailscale-archive-keyring.gpg
	curl -fsSL "https://pkgs.tailscale.com/stable/${ID}/${VERSION_CODENAME}.tailscale-keyring.list" \
		-o /etc/apt/sources.list.d/tailscale.list
	apt-get update
	DEBIAN_FRONTEND=noninteractive apt-get install -y tailscale
fi

if [[ -n "${TAILSCALE_ROUTES}" ]]; then
	# 只有显式广告子路由时才持久开启 IPv4 forwarding，默认运维入口机模式不抢现有 LAN 路由。
	cat >/etc/sysctl.d/99-tailscale-subnet-router.conf <<'EOSYSCTL'
net.ipv4.ip_forward = 1
EOSYSCTL
	sysctl --system >/dev/null
fi

systemctl enable --now tailscaled

tailscale_up_args=(
	"--reset"
	"--authkey=${TAILSCALE_AUTH_KEY}"
	"--hostname=${TAILSCALE_HOSTNAME}"
	"--accept-dns=${TAILSCALE_ACCEPT_DNS}"
)

if [[ -n "${TAILSCALE_ROUTES}" ]]; then
	tailscale_up_args+=("--advertise-routes=${TAILSCALE_ROUTES}")
fi

if [[ -n "${TAILSCALE_ADVERTISE_TAGS}" ]]; then
	tailscale_up_args+=("--advertise-tags=${TAILSCALE_ADVERTISE_TAGS}")
fi

if [[ "${TAILSCALE_SSH}" == "true" ]]; then
	tailscale_up_args+=("--ssh")
fi

if [[ -n "${TAILSCALE_LOGIN_SERVER}" ]]; then
	tailscale_up_args+=("--login-server=${TAILSCALE_LOGIN_SERVER}")
fi

printf '==> tailscale up (%s)\n' "${TAILSCALE_HOSTNAME}"
tailscale up "${tailscale_up_args[@]}"

printf '\n==> tailscale status\n'
tailscale status || true

printf '\n==> tailscale IPv4\n'
tailscale ip -4 || true

printf '\n==> next steps\n'
if [[ -n "${TAILSCALE_ROUTES}" ]]; then
	printf -- '- approve advertised route(s): %s\n' "${TAILSCALE_ROUTES}"
else
	printf -- '- confirm the host is online in the Tailscale admin panel\n'
	printf -- '- if you already have another subnet router for 192.168.0.0/24, keep it as primary and use this host for SSH/jump access\n'
fi
if [[ -n "${TAILSCALE_ADVERTISE_TAGS}" ]]; then
	printf -- '- confirm tag owner policy for: %s\n' "${TAILSCALE_ADVERTISE_TAGS}"
fi
printf -- '- verify SSH or port-forward access to Portal/Grafana/Argo through this host\n'
EOF
} | ssh "${ssh_opts[@]}" "${router_host}" 'bash -s'

printf '==> done: tailscale ops host bootstrap finished on %s\n' "${router_host}"
