import { useEffect, useState } from 'react'
import { jwtDecode } from 'jwt-decode'

export const AUTH_SCOPE = {
  USER: 'user',
  ADMIN: 'admin',
}

const LEGACY_TOKEN_KEY = 'access_token'
const TOKEN_KEYS = {
  [AUTH_SCOPE.USER]: 'user_access_token',
  [AUTH_SCOPE.ADMIN]: 'admin_access_token',
}
const META_KEYS = ['expires_at', 'token_type', 'user_id', 'username']
const JSON_META_KEYS = ['roles', 'permissions']
const AUTH_CHANGED_EVENT = 'webapp-template:auth-changed'

function normalizeScope(scope = AUTH_SCOPE.USER) {
  return scope === AUTH_SCOPE.ADMIN ? AUTH_SCOPE.ADMIN : AUTH_SCOPE.USER
}

function getScopedMetaKey(scope, key) {
  return `${scope}_${key}`
}

function migrateLegacyUserToken() {
  const userKey = TOKEN_KEYS[AUTH_SCOPE.USER]
  const current = localStorage.getItem(userKey)
  if (current) return current

  const legacy = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (!legacy) return ''

  localStorage.setItem(userKey, legacy)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  return legacy
}

export function getToken(scope = AUTH_SCOPE.USER) {
  const normalizedScope = normalizeScope(scope)
  const key = TOKEN_KEYS[normalizedScope]
  const token = localStorage.getItem(key)
  if (token) return token

  // 兼容历史单 token 存储
  if (normalizedScope === AUTH_SCOPE.USER) {
    return migrateLegacyUserToken()
  }
  return ''
}

export function setToken(token, scope = AUTH_SCOPE.USER) {
  const normalizedScope = normalizeScope(scope)
  localStorage.setItem(TOKEN_KEYS[normalizedScope], token)
  if (normalizedScope === AUTH_SCOPE.USER) {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }
}

function setScopedMeta(scope, data) {
  META_KEYS.forEach((key) => {
    const value = data?.[key]
    if (value != null && value !== '') {
      localStorage.setItem(getScopedMetaKey(scope, key), String(value))
    } else {
      localStorage.removeItem(getScopedMetaKey(scope, key))
    }
  })
  JSON_META_KEYS.forEach((key) => {
    const value = data?.[key]
    if (Array.isArray(value)) {
      localStorage.setItem(getScopedMetaKey(scope, key), JSON.stringify(value))
    } else {
      localStorage.removeItem(getScopedMetaKey(scope, key))
    }
  })
}

function clearScopedMeta(scope) {
  META_KEYS.forEach((key) => {
    localStorage.removeItem(getScopedMetaKey(scope, key))
  })
  JSON_META_KEYS.forEach((key) => {
    localStorage.removeItem(getScopedMetaKey(scope, key))
  })
}

function notifyAuthChanged(scope) {
  window.dispatchEvent(
    new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: { scope: normalizeScope(scope) },
    })
  )
}

function getScopedJsonMeta(scope, key) {
  const raw = localStorage.getItem(getScopedMetaKey(scope, key))
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

export function persistAuth(data, scope = AUTH_SCOPE.USER) {
  const token = data?.access_token
  if (!token) throw new Error('missing access_token')

  const normalizedScope = normalizeScope(scope)
  setToken(String(token), normalizedScope)
  setScopedMeta(normalizedScope, data || {})
  notifyAuthChanged(normalizedScope)
}

export function updateAuthMeta(data, scope = AUTH_SCOPE.USER) {
  const normalizedScope = normalizeScope(scope)
  if (!getToken(normalizedScope)) return
  setScopedMeta(normalizedScope, data || {})
  notifyAuthChanged(normalizedScope)
}

export function getLoginPath(scope = AUTH_SCOPE.USER) {
  return normalizeScope(scope) === AUTH_SCOPE.ADMIN ? '/admin-login' : '/login'
}

export function logout(scope = AUTH_SCOPE.USER) {
  const normalizedScope = normalizeScope(scope)
  localStorage.removeItem(TOKEN_KEYS[normalizedScope])
  clearScopedMeta(normalizedScope)
  if (normalizedScope === AUTH_SCOPE.USER) {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  }
  notifyAuthChanged(normalizedScope)

  try {
    sessionStorage.clear()
  } catch (e) {
    console.warn('清空 sessionStorage 失败', e)
  }
}

function isExpired(claims) {
  if (!claims?.exp) return true
  return claims.exp * 1000 <= Date.now()
}

export function getCurrentUser(scope = AUTH_SCOPE.USER) {
  const normalizedScope = normalizeScope(scope)
  const token = getToken(normalizedScope)
  if (!token) return null
  try {
    const claims = jwtDecode(token)
    if (isExpired(claims)) {
      logout(normalizedScope)
      return null
    }
    return {
      id: claims.uid,
      username: claims.uname,
      role: Number(claims.role) === 1 ? 'admin' : 'user',
      roles: getScopedJsonMeta(normalizedScope, 'roles'),
      permissions: getScopedJsonMeta(normalizedScope, 'permissions'),
      exp: claims.exp, // 秒级时间戳
    }
  } catch {
    logout(normalizedScope)
    return null
  }
}

export function isLoggedIn(scope = AUTH_SCOPE.USER) {
  return !!getCurrentUser(scope)
}

export function useCurrentUser(scope = AUTH_SCOPE.USER) {
  const normalizedScope = normalizeScope(scope)
  const [user, setUser] = useState(() => getCurrentUser(normalizedScope))

  useEffect(() => {
    const refresh = (event) => {
      if (event?.detail?.scope && event.detail.scope !== normalizedScope) return
      setUser(getCurrentUser(normalizedScope))
    }

    window.addEventListener(AUTH_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [normalizedScope])

  return user
}
