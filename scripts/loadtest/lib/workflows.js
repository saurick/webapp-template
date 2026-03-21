import { check, sleep } from 'k6'

import {
  authMode,
  authUrl,
  ensureAuthConfig,
  buildUniqueUsername,
  loginPassword,
  loginUsername,
  logoutAfterAuth,
  registerPassword,
  systemUrl,
  thinkTimeMs,
} from './config.js'
import {
  authRegisterCreatedUsers,
  authTokenMissing,
  httpGetText,
  rpcCall,
} from './http.js'

function sleepThinkTime() {
  if (thinkTimeMs <= 0) return
  sleep(thinkTimeMs / 1000)
}

function resolveAuthCredentials() {
  // 默认走 register，避免仓库必须预置固定账号才能先把压测链路跑通。
  if (authMode === 'login') {
    ensureAuthConfig()
    return {
      method: 'login',
      username: loginUsername,
      password: loginPassword,
    }
  }

  return {
    method: 'register',
    username: buildUniqueUsername(),
    password: registerPassword,
  }
}

export function runHealthFlow() {
  httpGetText('/healthz', {
    // 保守起见只校验 200；当前 live 入口会把 /healthz 正文折成空串，避免这里误报。
    tags: { flow: 'health', endpoint: 'healthz' },
  })
  httpGetText('/readyz', {
    expectedBody: 'ready',
    tags: { flow: 'health', endpoint: 'readyz' },
  })

  sleepThinkTime()
}

export function runSystemFlow() {
  const ping = rpcCall({
    url: systemUrl,
    method: 'ping',
    tags: { flow: 'system', step: 'ping' },
  })
  check(ping.payload, {
    'system.ping returns pong': (payload) => payload?.result?.data?.pong === 'pong',
  })

  const version = rpcCall({
    url: systemUrl,
    method: 'version',
    tags: { flow: 'system', step: 'version' },
  })
  check(version.payload, {
    'system.version returns version': (payload) =>
      typeof payload?.result?.data?.version === 'string' &&
      payload.result.data.version.length > 0,
  })

  sleepThinkTime()
}

export function runAuthFlow() {
  const { method, username, password } = resolveAuthCredentials()

  const auth = rpcCall({
    url: authUrl,
    method,
    params: { username, password },
    tags: { flow: 'auth', step: method },
  })
  const token = auth.payload?.result?.data?.access_token || ''

  authTokenMissing.add(token === '', { flow: 'auth', step: method })
  check(auth.payload, {
    [`auth.${method} token present`]: (payload) =>
      Boolean(payload?.result?.data?.access_token),
    [`auth.${method} username echoed`]: (payload) =>
      payload?.result?.data?.username === username,
  })

  // 上游登录失败时直接止损，避免后续 me/logout 继续制造噪声。
  if (!token) {
    sleepThinkTime()
    return
  }
  if (method === 'register') {
    authRegisterCreatedUsers.add(1)
  }

  const me = rpcCall({
    url: authUrl,
    method: 'me',
    token,
    tags: { flow: 'auth', step: 'me' },
  })
  check(me.payload, {
    'auth.me returns same username': (payload) =>
      payload?.result?.data?.username === username,
  })

  if (logoutAfterAuth) {
    rpcCall({
      url: authUrl,
      method: 'logout',
      token,
      tags: { flow: 'auth', step: 'logout' },
    })
  }

  sleepThinkTime()
}
