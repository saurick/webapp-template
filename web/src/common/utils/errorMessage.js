// web/src/common/utils/errorMessage.js
import { logout } from '@/common/auth/auth'
import {
  DEFAULT_RPC_ERROR_MESSAGES,
  isAuthFailureCode,
} from '@/common/consts/errorCodes'

export function handleRpcError(err, { onNeedLogin } = {}) {
  const code = err?.code
  const msg = DEFAULT_RPC_ERROR_MESSAGES[code] || err?.message || '请求失败'

  // 仅登录态失效才触发登出，权限不足要保留当前会话。
  if (isAuthFailureCode(code)) {
    logout()
    onNeedLogin?.()
  }

  return msg
}

export const ERROR_MESSAGES = DEFAULT_RPC_ERROR_MESSAGES
