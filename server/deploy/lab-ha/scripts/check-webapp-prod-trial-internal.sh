#!/usr/bin/env bash
set -euo pipefail

# 当前生产试验默认通过内部域名 + 多节点 NodePort 验证 Host 路由，
# 避免跨 VPN / 子网路由客户端直接依赖 MetalLB L2 VIP。
HOST_HEADER="${HOST_HEADER:-webapp-trial.lab.home.arpa}"
NODE_PORT="${NODE_PORT:-32668}"
PATH_SUFFIX="${PATH_SUFFIX:-/readyz}"
if [[ "$#" -gt 0 ]]; then
	NODES=("$@")
else
	NODES=("192.168.0.7" "192.168.0.108" "192.168.0.128")
fi

FAILURES=0

printf 'Checking host=%s path=%s port=%s\n' "$HOST_HEADER" "$PATH_SUFFIX" "$NODE_PORT"

for node in "${NODES[@]}"; do
	code="$(
		curl --noproxy '*' \
			-m 5 \
			-sS \
			-o /tmp/webapp-prod-trial-check.out \
			-w '%{http_code}' \
			-H "Host: ${HOST_HEADER}" \
			"http://${node}:${NODE_PORT}${PATH_SUFFIX}" || printf 'ERR'
	)"

	if [[ "$code" == "200" ]]; then
		printf '[OK]   %s -> %s\n' "$node" "$code"
		continue
	fi

	FAILURES=$((FAILURES + 1))
	body="$(tr '\n' ' ' </tmp/webapp-prod-trial-check.out 2>/dev/null | cut -c1-120)"
	printf '[FAIL] %s -> %s %s\n' "$node" "$code" "$body"
done

rm -f /tmp/webapp-prod-trial-check.out

if [[ "$FAILURES" -gt 0 ]]; then
	printf '\nDetected %s failing endpoint(s).\n' "$FAILURES" >&2
	exit 1
fi

printf '\nAll endpoints are healthy.\n'
