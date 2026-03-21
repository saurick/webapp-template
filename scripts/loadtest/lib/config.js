const DEFAULT_BASE_URL = 'http://127.0.0.1:8200'
const DEFAULT_USER_AGENT = 'webapp-template-loadtest/0.1'
const REGISTER_PASSWORD_FALLBACK = 'Passw0rd!123'

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function readInt(name, fallback) {
  const raw = (__ENV[name] || '').trim()
  if (!raw) return fallback

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBool(name, fallback = false) {
  const raw = (__ENV[name] || '').trim().toLowerCase()
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw)
}

function sanitize(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '_')
}

function resolveAuthMode() {
  const explicit = (__ENV.LOADTEST_AUTH_MODE || '').trim()
  if (explicit) return explicit

  if ((__ENV.LOADTEST_USERNAME || '').trim() && (__ENV.LOADTEST_PASSWORD || '').trim()) {
    return 'login'
  }

  return 'register'
}

export const runId = sanitize(
  __ENV.LOADTEST_RUN_ID || `lt_${new Date().toISOString().replace(/[-:.TZ]/g, '')}`
)
export const baseUrl = trimTrailingSlash(__ENV.BASE_URL || DEFAULT_BASE_URL)
export const hostHeader = (__ENV.LOADTEST_HOST_HEADER || '').trim()
export const userAgent = (__ENV.LOADTEST_USER_AGENT || DEFAULT_USER_AGENT).trim()
export const thinkTimeMs = readInt('LOADTEST_THINK_TIME_MS', 500)

export const authUrl = (__ENV.LOADTEST_AUTH_URL || 'auth').trim()
export const systemUrl = (__ENV.LOADTEST_SYSTEM_URL || 'system').trim()

export const authMode = resolveAuthMode()
export const loginUsername = (__ENV.LOADTEST_USERNAME || '').trim()
export const loginPassword = (__ENV.LOADTEST_PASSWORD || '').trim()
export const registerPassword = loginPassword || REGISTER_PASSWORD_FALLBACK
export const logoutAfterAuth = readBool('LOADTEST_LOGOUT_AFTER_AUTH')

export function ensureAuthConfig() {
  if (authMode !== 'login') return
  if (loginUsername && loginPassword) return

  throw new Error(
    'LOADTEST_AUTH_MODE=login 时必须同时提供 LOADTEST_USERNAME 和 LOADTEST_PASSWORD'
  )
}

export function buildUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

export function buildHeaders({
  token = '',
  requestId = '',
  contentType = 'application/json',
  extra = {},
} = {}) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': userAgent,
    // 复用现有 request_id 透传能力，方便在日志里筛选整轮压测。
    'X-Loadtest-Run-Id': runId,
  }

  if (contentType) {
    headers['Content-Type'] = contentType
  }
  if (requestId) {
    headers['X-Request-Id'] = requestId
  }
  if (hostHeader) {
    headers.Host = hostHeader
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  Object.keys(extra).forEach((key) => {
    headers[key] = extra[key]
  })
  return headers
}

export function buildUniqueUsername(prefix = 'ltuser') {
  return sanitize(`${prefix}_${runId}_${__VU}_${__ITER}`).slice(0, 60)
}
