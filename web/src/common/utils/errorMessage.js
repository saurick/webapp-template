// server/web/src/common/utils/errorMessge.js
import { logout } from '@/common/auth/auth'

export function handleRpcError(err, { onNeedLogin } = {}) {
  const code = err?.code
  const msg = ERROR_MESSAGES[code] || err?.message || '请求失败'

  // token 过期：你也可以约定 10005
  if (code === 40302 || code === 10005) {
    logout()
    onNeedLogin?.()
  }

  return msg
}

export const ERROR_MESSAGES = {
    40301: '只有管理员才能操作',
    40302: '请先登录',
    10001: '用户不存在',
    10002: '密码错误',
    10003: '用户已被禁用',
    10004: '用户名已存在',
    20001: '邀请码不存在',
    20002: '邀请码已用完',
    20003: '邀请码已过期',
    20004: '邀请码已被禁用',
  }
  