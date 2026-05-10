export const ADMIN_PERMISSIONS = {
  ADMIN_ACCESS: 'admin.access',
  USER_READ: 'admin.user.read',
  USER_WRITE: 'admin.user.write',
  RBAC_READ: 'admin.rbac.read',
}

export function hasAdminPermission(user, permission) {
  if (!permission) return true
  return (
    Array.isArray(user?.permissions) && user.permissions.includes(permission)
  )
}
