import http from 'k6/http'
import { check } from 'k6'
import { Counter, Rate } from 'k6/metrics'

import { buildHeaders, buildUrl, runId } from './config.js'

let requestSeq = 0

export const rpcBizFailed = new Rate('rpc_biz_failed')
export const rpcPayloadFailed = new Rate('rpc_payload_failed')
export const authTokenMissing = new Rate('auth_token_missing')
export const authRegisterCreatedUsers = new Counter('auth_register_created_users')

function stringifyTags(tags = {}) {
  return Object.fromEntries(
    Object.entries(tags).map(([key, value]) => [key, String(value)])
  )
}

function nextRequestId() {
  requestSeq += 1
  return `${runId}-vu${__VU || 0}-iter${__ITER || 0}-req${requestSeq}`
}

function isExpectedCode(actual, expected) {
  if (Array.isArray(expected)) return expected.includes(actual)
  return actual === expected
}

export function httpGetText(path, { expectedStatus = 200, expectedBody, tags = {} } = {}) {
  const requestId = nextRequestId()
  const response = http.get(buildUrl(path), {
    headers: buildHeaders({
      requestId,
      contentType: '',
    }),
    tags: stringifyTags(tags),
  })

  check(response, {
    [`${path} status=${expectedStatus}`]: (res) => res.status === expectedStatus,
    [`${path} body ok`]: (res) =>
      expectedBody === undefined || String(res.body).trim() === expectedBody,
  })

  return { response, requestId }
}

export function rpcCall({
  url,
  method,
  params = {},
  token = '',
  tags = {},
  expectedCode = 0,
} = {}) {
  const requestId = nextRequestId()
  const response = http.post(
    buildUrl(`/rpc/${url}`),
    JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    }),
    {
      headers: buildHeaders({ token, requestId }),
      tags: stringifyTags({
        url,
        method,
        ...tags,
      }),
    }
  )

  let payload = null
  try {
    payload = response.json()
  } catch (_) {
    payload = null
  }

  const resultCode = payload?.result?.code
  const payloadOk = payload !== null && typeof resultCode === 'number'

  rpcPayloadFailed.add(!payloadOk, stringifyTags({ url, method }))
  rpcBizFailed.add(
    !payloadOk || !isExpectedCode(resultCode, expectedCode),
    stringifyTags({ url, method })
  )

  check(response, {
    [`${url}.${method} http 200`]: (res) => res.status === 200,
    [`${url}.${method} payload ok`]: () => payloadOk,
    [`${url}.${method} result.code ok`]: () =>
      payloadOk && isExpectedCode(resultCode, expectedCode),
  })

  return { response, payload, requestId }
}

