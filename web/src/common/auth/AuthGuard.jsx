// web/src/common/auth/AuthGuard.jsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AUTH_SCOPE, getLoginPath, useCurrentUser } from '@/common/auth/auth'
import { hasAdminPermission } from '@/common/consts/adminPermissions'

/**
 * AuthGuard 保护路由
 * @param {boolean} requireAdmin - 是否需要管理员权限
 * @param {string} permission - 管理员权限码，前端只做显示保护，服务端仍是真权限边界
 * @param {React.ReactNode} children - 子组件
 * @returns {React.ReactNode} 保护路由组件
 */
export default function AuthGuard({
  requireAdmin = false,
  permission = '',
  children,
}) {
  const location = useLocation()
  const authScope = requireAdmin ? AUTH_SCOPE.ADMIN : AUTH_SCOPE.USER
  const user = useCurrentUser(authScope)

  // 未登录 → 去登录页
  if (!user) {
    return (
      <Navigate
        to={getLoginPath(authScope)}
        replace
        state={{ from: location }}
      />
    )
  }

  // 需要管理员但不是 admin
  if (requireAdmin && user.role !== 'admin') {
    return (
      <Navigate
        to={getLoginPath(AUTH_SCOPE.ADMIN)}
        replace
        state={{ from: location }}
      />
    )
  }

  if (
    requireAdmin &&
    permission &&
    user.permissions.length > 0 &&
    !hasAdminPermission(user, permission)
  ) {
    return <Navigate to="/admin-menu" replace />
  }

  return children
}
