#!/usr/bin/env bash
set -euo pipefail

KUBECONFIG="${KUBECONFIG:-/Users/simon/.kube/ha-lab.conf}"
MIN_AGE_SECONDS="${MIN_AGE_SECONDS:-300}"

if ! command -v jq >/dev/null 2>&1; then
	echo "jq is required to clean stale controlled pods" >&2
	exit 1
fi

now_epoch="$(date -u +%s)"
pod_json="$(kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" get pods -A -o json)"
candidates="$(
	printf '%s' "$pod_json" | jq -r --argjson now "$now_epoch" --argjson minAge "$MIN_AGE_SECONDS" '
		.items[]
		| (.metadata.ownerReferences // [] | map(select(.controller == true))) as $owners
		| select(($owners | length) > 0)
		| (.metadata.creationTimestamp | fromdateiso8601) as $createdAt
		| ((.metadata.deletionTimestamp // null) | if . == null then null else fromdateiso8601 end) as $deletingAt
		| ($now - $createdAt) as $createdAge
		| (if $deletingAt == null then null else ($now - $deletingAt) end) as $deletingAge
		| select($createdAge >= $minAge)
		| select(
			(.status.phase == "Unknown")
			or ($deletingAge != null and $deletingAge >= $minAge)
		)
		| [
			.metadata.namespace,
			.metadata.name,
			(.status.phase // "Unknown"),
			($owners[0].kind + "/" + $owners[0].name),
			($createdAge | floor | tostring),
			(if $deletingAge == null then "" else ($deletingAge | floor | tostring) end)
		]
		| @tsv
	'
)"

if [[ -z "$candidates" ]]; then
	echo "stale_pod_candidates=0"
	echo "deleted_count=0"
	exit 0
fi

candidate_count="$(printf '%s\n' "$candidates" | awk 'NF {count++} END {print count+0}')"
deleted_count=0
printf 'stale_pod_candidates=%s\n' "$candidate_count"

while IFS=$'\t' read -r namespace name phase owner created_age deleting_age; do
	[[ -n "$namespace" ]] || continue
	# 这里只清 controller 挂着的陈旧 Pod，对真实仍在运行的裸 Pod 不做自动删除。
	printf 'delete=%s/%s phase=%s owner=%s age=%ss deleting_age=%ss\n' \
		"$namespace" "$name" "$phase" "$owner" "$created_age" "${deleting_age:-0}"
	kubectl --request-timeout=20s --kubeconfig "$KUBECONFIG" -n "$namespace" delete pod "$name" --force --grace-period=0 >/dev/null
	deleted_count=$((deleted_count + 1))
done <<<"$candidates"

printf 'deleted_count=%s\n' "$deleted_count"
