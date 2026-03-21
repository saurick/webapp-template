#!/usr/bin/env bash
set -euo pipefail

scenario="${1:-}"
summary_path="${LOADTEST_SUMMARY_PATH:-}"
report_path="${LOADTEST_REPORT_PATH:-}"

if [[ -z "${scenario}" || -z "${summary_path}" || -z "${report_path}" ]]; then
	printf 'curl fallback 缺少必要参数\n' >&2
	exit 2
fi

base_url="${BASE_URL:-http://127.0.0.1:8200}"
run_id="${LOADTEST_RUN_ID:-lt-curl-fallback}"
host_header="${LOADTEST_HOST_HEADER:-}"
user_agent="${LOADTEST_USER_AGENT:-webapp-template-loadtest/0.1}"
vus="${LOADTEST_VUS:-5}"
duration_raw="${LOADTEST_DURATION:-30s}"
think_time_ms="${LOADTEST_THINK_TIME_MS:-500}"
connect_timeout="${LOADTEST_HTTP_CONNECT_TIMEOUT:-2}"
request_timeout="${LOADTEST_HTTP_MAX_TIME:-10}"
tmp_root="$(mktemp -d)"

cleanup() {
	rm -rf "${tmp_root}"
}
trap cleanup EXIT

parse_duration_seconds() {
	local raw="${1:-30s}"
	case "${raw}" in
	*[!0-9smh] | "")
		printf '30'
		;;
	*[smh])
		local value="${raw%[smh]}"
		local unit="${raw:${#raw}-1:1}"
		case "${unit}" in
		s) printf '%s' "${value}" ;;
		m) printf '%s' "$((value * 60))" ;;
		h) printf '%s' "$((value * 3600))" ;;
		esac
		;;
	*)
		printf '%s' "${raw}"
		;;
	esac
}

sleep_think_time() {
	if [[ "${think_time_ms}" =~ ^[0-9]+$ ]] && ((think_time_ms > 0)); then
		sleep "$(awk -v value="${think_time_ms}" 'BEGIN { printf "%.3f", value / 1000 }')"
	fi
}

json_escape() {
	local value="${1:-}"
	value="${value//\\/\\\\}"
	value="${value//\"/\\\"}"
	value="${value//$'\n'/\\n}"
	value="${value//$'\r'/\\r}"
	value="${value//$'\t'/\\t}"
	printf '%s' "${value}"
}

record_result() {
	local file="$1"
	local label="$2"
	local ok="$3"
	local status="$4"
	local duration_ms="$5"
	local request_id="$6"
	printf '%s\t%s\t%s\t%s\t%s\n' "${label}" "${ok}" "${status}" "${duration_ms}" "${request_id}" >>"${file}"
}

curl_request() {
	local method="$1"
	local url="$2"
	local body="${3:-}"
	local token="${4:-}"
	local request_id="$5"
	local body_file err_file curl_output curl_exit
	local -a curl_args

	body_file="$(mktemp "${tmp_root}/body.XXXXXX")"
	err_file="$(mktemp "${tmp_root}/err.XXXXXX")"
	curl_args=(
		curl
		-sS
		--connect-timeout "${connect_timeout}"
		--max-time "${request_timeout}"
		-o "${body_file}"
		-w "%{http_code} %{time_total}"
		-X "${method}"
		-H "Accept: application/json"
		-H "User-Agent: ${user_agent}"
		-H "X-Loadtest-Run-Id: ${run_id}"
		-H "X-Request-Id: ${request_id}"
	)
	if [[ -n "${host_header}" ]]; then
		curl_args+=(-H "Host: ${host_header}")
	fi
	if [[ -n "${token}" ]]; then
		curl_args+=(-H "Authorization: Bearer ${token}")
	fi
	if [[ -n "${body}" ]]; then
		curl_args+=(-H "Content-Type: application/json" --data "${body}")
	fi
	curl_args+=("${url}")

	set +e
	curl_output="$("${curl_args[@]}" 2>"${err_file}")"
	curl_exit=$?
	set -e

	LAST_RESPONSE_BODY="$(cat "${body_file}")"
	LAST_RESPONSE_BODY_COMPACT="$(printf '%s' "${LAST_RESPONSE_BODY}" | tr -d '\r\n\t ')"
	if ((curl_exit == 0)); then
		LAST_RESPONSE_STATUS="${curl_output%% *}"
		LAST_RESPONSE_TIME_MS="$(awk -v value="${curl_output##* }" 'BEGIN { printf "%.3f", value * 1000 }')"
	else
		LAST_RESPONSE_STATUS="0"
		LAST_RESPONSE_TIME_MS="0"
		printf 'curl fallback request failed method=%s url=%s request_id=%s detail=%s\n' \
			"${method}" "${url}" "${request_id}" "$(tr '\n' ' ' <"${err_file}")" >&2
	fi
}

run_health_request() {
	local label="$1"
	local path="$2"
	local expected_body="${3:-}"
	local metrics_file="$4"
	local request_id="$5"
	local ok="0"
	local trimmed_body

	curl_request "GET" "${base_url}${path}" "" "" "${request_id}"
	trimmed_body="$(printf '%s' "${LAST_RESPONSE_BODY}" | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
	if [[ "${LAST_RESPONSE_STATUS}" == "200" ]]; then
		if [[ -z "${expected_body}" || "${trimmed_body}" == "${expected_body}" ]]; then
			ok="1"
		fi
	fi
	record_result "${metrics_file}" "${label}" "${ok}" "${LAST_RESPONSE_STATUS}" "${LAST_RESPONSE_TIME_MS}" "${request_id}"
	if [[ "${ok}" != "1" ]]; then
		printf 'curl fallback check failed label=%s status=%s request_id=%s body=%s\n' \
			"${label}" "${LAST_RESPONSE_STATUS}" "${request_id}" "${trimmed_body}" >&2
	fi
}

run_system_request() {
	local label="$1"
	local method_name="$2"
	local expected_fragment="$3"
	local extra_match="$4"
	local metrics_file="$5"
	local request_id="$6"
	local request_body ok

	ok="0"
	request_body="{\"jsonrpc\":\"2.0\",\"id\":\"$(json_escape "${request_id}")\",\"method\":\"$(json_escape "${method_name}")\",\"params\":{}}"
	curl_request "POST" "${base_url}/rpc/system" "${request_body}" "" "${request_id}"
	if [[ "${LAST_RESPONSE_STATUS}" == "200" ]] && [[ "${LAST_RESPONSE_BODY_COMPACT}" == *"${expected_fragment}"* ]]; then
		if [[ -z "${extra_match}" ]] || printf '%s' "${LAST_RESPONSE_BODY_COMPACT}" | grep -Eq "${extra_match}"; then
			ok="1"
		fi
	fi
	record_result "${metrics_file}" "${label}" "${ok}" "${LAST_RESPONSE_STATUS}" "${LAST_RESPONSE_TIME_MS}" "${request_id}"
	if [[ "${ok}" != "1" ]]; then
		printf 'curl fallback check failed label=%s status=%s request_id=%s body=%s\n' \
			"${label}" "${LAST_RESPONSE_STATUS}" "${request_id}" "${LAST_RESPONSE_BODY_COMPACT}" >&2
	fi
}

worker_health() {
	local vu="$1"
	local metrics_file="$2"
	local deadline="$3"
	local iter=0
	local req=0

	while (("$(date +%s)" < deadline)); do
		iter=$((iter + 1))
		req=$((req + 1))
		run_health_request "healthz" "/healthz" "" "${metrics_file}" "${run_id}-vu${vu}-iter${iter}-req${req}"
		req=$((req + 1))
		run_health_request "readyz" "/readyz" "ready" "${metrics_file}" "${run_id}-vu${vu}-iter${iter}-req${req}"
		sleep_think_time
	done
}

worker_system() {
	local vu="$1"
	local metrics_file="$2"
	local deadline="$3"
	local iter=0
	local req=0

	while (("$(date +%s)" < deadline)); do
		iter=$((iter + 1))
		req=$((req + 1))
		run_system_request "system.ping" "ping" '"code":0' '"pong":"pong"' "${metrics_file}" "${run_id}-vu${vu}-iter${iter}-req${req}"
		req=$((req + 1))
		run_system_request "system.version" "version" '"code":0' '"version":"[^"]+"' "${metrics_file}" "${run_id}-vu${vu}-iter${iter}-req${req}"
		sleep_think_time
	done
}

percentile_from_file() {
	local file="$1"
	local percentile="$2"
	local count index

	count="$(wc -l <"${file}" | tr -d ' ')"
	if [[ -z "${count}" || "${count}" == "0" ]]; then
		printf '0'
		return
	fi
	index="$(awk -v count="${count}" -v pct="${percentile}" 'BEGIN { idx = int((count * pct) + 0.999999); if (idx < 1) idx = 1; if (idx > count) idx = count; print idx }')"
	sed -n "${index}p" "${file}"
}

render_report() {
	local report_file="$1"
	local status_label="$2"
	local total="$3"
	local ok_count="$4"
	local fail_count="$5"
	local p95="$6"
	local fail_rate="$7"
	local started_at="$8"
	local finished_at="$9"

	cat >"${report_file}" <<EOF
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Load Test Report</title>
  <style>
    :root { color-scheme: light; font-family: "SF Pro Display", "PingFang SC", sans-serif; }
    body { margin: 0; background: #f4f6f8; color: #16212c; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px 48px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .sub { margin: 0 0 24px; color: #5a6673; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 16px 18px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    .label { display: block; font-size: 12px; color: #6b7785; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    .value { font-size: 24px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    th, td { padding: 14px 16px; border-bottom: 1px solid #e6ebf0; text-align: left; }
    th { width: 220px; background: #f8fafc; }
    tr:last-child th, tr:last-child td { border-bottom: 0; }
  </style>
</head>
<body>
  <main>
    <h1>Load Test Report</h1>
    <p class="sub">engine: curl fallback · scenario: ${scenario} · target: ${base_url}</p>
    <section class="grid">
      <article class="card"><span class="label">Status</span><span class="value">${status_label}</span></article>
      <article class="card"><span class="label">Requests</span><span class="value">${total}</span></article>
      <article class="card"><span class="label">Failures</span><span class="value">${fail_count}</span></article>
      <article class="card"><span class="label">p95</span><span class="value">${p95} ms</span></article>
    </section>
    <table>
      <tr><th>Run ID</th><td>${run_id}</td></tr>
      <tr><th>Successful Requests</th><td>${ok_count}</td></tr>
      <tr><th>Failed Requests</th><td>${fail_count}</td></tr>
      <tr><th>Failure Rate</th><td>${fail_rate}</td></tr>
      <tr><th>Started At (UTC)</th><td>${started_at}</td></tr>
      <tr><th>Finished At (UTC)</th><td>${finished_at}</td></tr>
    </table>
  </main>
</body>
</html>
EOF
}

duration_seconds="$(parse_duration_seconds "${duration_raw}")"
if [[ ! "${vus}" =~ ^[0-9]+$ ]] || ((vus <= 0)); then
	vus=1
fi
if [[ ! "${duration_seconds}" =~ ^[0-9]+$ ]] || ((duration_seconds <= 0)); then
	duration_seconds=30
fi

case "${scenario}" in
health | system) ;;
*)
	printf 'curl fallback 当前只支持 health/system，收到场景: %s\n' "${scenario}" >&2
	exit 127
	;;
esac

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
start_epoch="$(date +%s)"
deadline="$((start_epoch + duration_seconds))"

printf 'loadtest engine=curl-fallback\n'
printf 'loadtest fallback duration=%ss vus=%s\n' "${duration_seconds}" "${vus}"

for worker in $(seq 1 "${vus}"); do
	metrics_file="${tmp_root}/worker-${worker}.tsv"
	case "${scenario}" in
	health) worker_health "${worker}" "${metrics_file}" "${deadline}" ;;
	system) worker_system "${worker}" "${metrics_file}" "${deadline}" ;;
	esac &
done
wait

merged_metrics="${tmp_root}/metrics.tsv"
cat "${tmp_root}"/worker-*.tsv >"${merged_metrics}"

total_requests="$(awk 'END { print NR + 0 }' "${merged_metrics}")"
ok_requests="$(awk -F'\t' '$2 == 1 { count += 1 } END { print count + 0 }' "${merged_metrics}")"
fail_requests="$((total_requests - ok_requests))"
iterations_count="$((total_requests / 2))"
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
finish_epoch="$(date +%s)"
elapsed_seconds="$((finish_epoch - start_epoch))"
if ((elapsed_seconds <= 0)); then
	elapsed_seconds=1
fi

durations_sorted="${tmp_root}/durations.sorted"
cut -f4 "${merged_metrics}" | sort -g >"${durations_sorted}"

avg_duration="$(awk -F'\t' '{ sum += $4 } END { if (NR == 0) { print "0" } else { printf "%.3f", sum / NR } }' "${merged_metrics}")"
min_duration="$(head -n1 "${durations_sorted}" 2>/dev/null || printf '0')"
med_duration="$(percentile_from_file "${durations_sorted}" 0.50)"
max_duration="$(tail -n1 "${durations_sorted}" 2>/dev/null || printf '0')"
p90_duration="$(percentile_from_file "${durations_sorted}" 0.90)"
p95_duration="$(percentile_from_file "${durations_sorted}" 0.95)"
http_rate="$(awk -v total="${total_requests}" -v elapsed="${elapsed_seconds}" 'BEGIN { if (elapsed <= 0) elapsed = 1; printf "%.6f", total / elapsed }')"
success_rate="$(awk -v ok="${ok_requests}" -v total="${total_requests}" 'BEGIN { if (total <= 0) { print "0" } else { printf "%.6f", ok / total } }')"
fail_rate="$(awk -v fail="${fail_requests}" -v total="${total_requests}" 'BEGIN { if (total <= 0) { print "0" } else { printf "%.6f", fail / total } }')"

cat >"${summary_path}" <<EOF
{
  "root_group": {
    "checks": [
      {
        "name": "${scenario}",
        "path": "::${scenario}",
        "passes": ${ok_requests},
        "fails": ${fail_requests}
      }
    ]
  },
  "metrics": {
    "checks": {
      "passes": ${ok_requests},
      "fails": ${fail_requests},
      "rate": ${success_rate}
    },
    "http_req_failed": {
      "passes": ${ok_requests},
      "fails": ${fail_requests},
      "rate": ${fail_rate}
    },
    "http_req_duration": {
      "avg": ${avg_duration},
      "min": ${min_duration},
      "med": ${med_duration},
      "max": ${max_duration},
      "p(90)": ${p90_duration},
      "p(95)": ${p95_duration}
    },
    "http_reqs": {
      "count": ${total_requests},
      "rate": ${http_rate}
    },
    "iterations": {
      "count": ${iterations_count},
      "rate": $(awk -v total="${iterations_count}" -v elapsed="${elapsed_seconds}" 'BEGIN { if (elapsed <= 0) elapsed = 1; printf "%.6f", total / elapsed }')
    }
  }
}
EOF

status_label="passed"
if ((fail_requests > 0)); then
	status_label="failed"
fi
render_report "${report_path}" "${status_label}" "${total_requests}" "${ok_requests}" "${fail_requests}" "${p95_duration}" "${fail_rate}" "${started_at}" "${finished_at}"

printf 'summary json: %s\n' "${summary_path}"
printf 'dashboard html: %s\n' "${report_path}"

if ((fail_requests > 0)); then
	exit 1
fi
