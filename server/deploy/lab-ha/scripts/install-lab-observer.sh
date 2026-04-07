#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
用法:
  bash /Users/simon/projects/webapp-template/server/deploy/lab-ha/scripts/install-lab-observer.sh

可选环境变量:
  LAB_OBSERVER_HOST=root@192.168.0.156
  LAB_OBSERVER_PORT=22
  LAB_OBSERVER_LISTEN_PORT=30088
  LAB_OBSERVER_SERVICE_USER=observer
  SSH_STRICT_HOSTKEY_CHECKING=no
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
require_tool scp

observer_host="${LAB_OBSERVER_HOST:-root@192.168.0.156}"
observer_port="${LAB_OBSERVER_PORT:-22}"
observer_listen_port="${LAB_OBSERVER_LISTEN_PORT:-30088}"
observer_service_user="${LAB_OBSERVER_SERVICE_USER:-observer}"
ssh_strict_hostkey_checking="${SSH_STRICT_HOSTKEY_CHECKING:-no}"
repo_root="/Users/simon/projects/webapp-template"
local_app="${repo_root}/server/deploy/lab-ha/scripts/lab-observer.py"
remote_dir="/opt/lab-observer"
remote_app="${remote_dir}/lab_observer.py"
remote_service="/etc/systemd/system/lab-observer.service"
tmp_copy="/tmp/lab_observer.py.$$"

if [[ ! -f "$local_app" ]]; then
  printf 'local app not found: %s\n' "$local_app" >&2
  exit 1
fi

ssh_opts=(
  -p "$observer_port"
  -o "StrictHostKeyChecking=${ssh_strict_hostkey_checking}"
)
scp_opts=(
  -P "$observer_port"
  -o "StrictHostKeyChecking=${ssh_strict_hostkey_checking}"
)

printf '==> copy lab-observer app to %s\n' "$observer_host"
scp "${scp_opts[@]}" "$local_app" "${observer_host}:${tmp_copy}"

printf '==> install systemd service on %s\n' "$observer_host"
ssh "${ssh_opts[@]}" "$observer_host" \
  "REMOTE_DIR=$(printf '%q' "$remote_dir") \
   REMOTE_APP=$(printf '%q' "$remote_app") \
   REMOTE_SERVICE=$(printf '%q' "$remote_service") \
   TMP_COPY=$(printf '%q' "$tmp_copy") \
   LAB_OBSERVER_LISTEN_PORT=$(printf '%q' "$observer_listen_port") \
   LAB_OBSERVER_SERVICE_USER=$(printf '%q' "$observer_service_user") \
   POWER_SEQUENCE_URL=$(printf '%q' "https://github.com/saurick/webapp-template/blob/master/server/deploy/lab-ha/docs/VM_POWER_SEQUENCE.md") \
   RECOVERY_RUNBOOK_URL=$(printf '%q' "https://github.com/saurick/webapp-template/blob/master/server/deploy/lab-ha/docs/RECOVERY_RUNBOOK.md") \
   bash -s" <<'EOF'
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  printf 'this script must run as root on the observer host\n' >&2
  exit 1
fi

packages=()
for pkg in python3 curl iputils-ping; do
  if ! dpkg -s "${pkg}" >/dev/null 2>&1; then
    packages+=("${pkg}")
  fi
done

if [[ "${#packages[@]}" -gt 0 ]]; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
fi

service_user="${LAB_OBSERVER_SERVICE_USER}"
if ! id "${service_user}" >/dev/null 2>&1; then
  service_user="root"
fi

install -d -m 0755 "${REMOTE_DIR}"
install -m 0755 "${TMP_COPY}" "${REMOTE_APP}"
rm -f "${TMP_COPY}"

cat >"${REMOTE_SERVICE}" <<UNIT
[Unit]
Description=Lab external power observer
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${service_user}
Group=${service_user}
WorkingDirectory=${REMOTE_DIR}
Environment=LAB_OBSERVER_LISTEN_HOST=0.0.0.0
Environment=LAB_OBSERVER_LISTEN_PORT=${LAB_OBSERVER_LISTEN_PORT}
Environment=LAB_OBSERVER_POWER_SEQUENCE_URL=${POWER_SEQUENCE_URL}
Environment=LAB_OBSERVER_RECOVERY_RUNBOOK_URL=${RECOVERY_RUNBOOK_URL}
ExecStart=/usr/bin/python3 ${REMOTE_APP}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now lab-observer.service
systemctl restart lab-observer.service

printf '\n==> lab-observer.service\n'
systemctl --no-pager --full status lab-observer.service | sed -n '1,18p'

printf '\n==> local healthz\n'
healthz_ok=0
for _ in $(seq 1 10); do
  if curl -fsS "http://127.0.0.1:${LAB_OBSERVER_LISTEN_PORT}/healthz" >/dev/null 2>&1; then
    healthz_ok=1
    break
  fi
  sleep 1
done

if [[ "${healthz_ok}" -ne 1 ]]; then
  printf 'lab-observer healthz did not become ready within 10s\n' >&2
  exit 1
fi

curl -fsS "http://127.0.0.1:${LAB_OBSERVER_LISTEN_PORT}/healthz"
EOF

printf '==> done: http://%s:%s\n' "${observer_host#*@}" "$observer_listen_port"
