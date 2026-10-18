#!/usr/bin/env sh
# 远程协议的最小引导；不接收 GitLab token，不升级已有软件。
set -eu
umask 077
[ "$(id -u)" = 0 ] && [ "$(uname -m)" = x86_64 ]
# shellcheck disable=SC1091
. /etc/os-release
case "$ID:$VERSION_ID" in
ubuntu:24.04 | ubuntu:26.04) ;;
*)
	echo '[remote:host] 仅支持 Ubuntu 24.04 / 26.04 amd64 构建机' >&2
	exit 1
	;;
esac
[ -d /run/systemd/system ]
if ! command -v python3 >/dev/null 2>&1; then
	apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 update >/dev/null 2>&1
	DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=30 install --yes --no-install-recommends python3 ca-certificates >/dev/null 2>&1
fi
python3 -c 'import sys; assert sys.version_info >= (3, 12), "需要 Python 3.12+"'
echo '[remote:host] SSH / sudo / Ubuntu / Python 基础检查通过'
