import { jwtDecode } from 'jwt-decode'

const TOKEN_KEY = 'access_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

function isExpired(claims) {
  if (!claims?.exp) return true
  return claims.exp * 1000 <= Date.now()
}

export function getCurrentUser() {
  const token = getToken()
  if (!token) return null
  try {
    const claims = jwtDecode(token)
    if (isExpired(claims)) {
      logout()
      return null
    }
    return {
      id: claims.uid,
      username: claims.uname,
      role: claims.role === 1 ? 'admin' : 'user',
      exp: claims.exp,  // 秒级时间戳
    }
  } catch {
    logout()
    return null
  }
}

export function isLoggedIn() {
  return !!getCurrentUser()
}
