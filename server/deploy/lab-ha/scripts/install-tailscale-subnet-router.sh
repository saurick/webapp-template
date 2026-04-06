#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 兼容旧入口名；正式脚本已收口为“运维入口机，可选再显式开启子路由”。
exec "${script_dir}/configure-tailscale-ops-host.sh" "$@"
