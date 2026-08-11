import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Select, Tag, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'
import AsyncState from '@/common/components/state/AsyncState'
import { AUTH_SCOPE } from '@/common/auth/auth'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'

function groupPermissions(permissions) {
  return permissions.reduce((groups, permission) => {
    const group = permission.group || '其他'
    if (!groups[group]) groups[group] = []
    groups[group].push(permission)
    return groups
  }, {})
}

export default function AdminRBACPage() {
  const requestSequence = useRef(0)
  const rbacRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'rbac',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedRoleKey, setSelectedRoleKey] = useState('')

  const fetchOverview = useCallback(async () => {
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    setErrMsg('')
    setLoading(true)
    try {
      const result = await rbacRpc.call('overview')
      if (sequence !== requestSequence.current) return

      const data = result?.data || result?.result?.data || {}
      const nextRoles = Array.isArray(data.roles) ? data.roles : []
      setRoles(nextRoles)
      setPermissions(Array.isArray(data.permissions) ? data.permissions : [])
      setSelectedRoleKey((current) =>
        nextRoles.some((role) => role.key === current)
          ? current
          : nextRoles[0]?.key || ''
      )
    } catch (error) {
      if (sequence !== requestSequence.current) return
      setErrMsg(getActionErrorMessage(error, '获取角色权限'))
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [rbacRpc])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const selectedRole = roles.find((role) => role.key === selectedRoleKey)
  const selectedKeys = new Set(
    Array.isArray(selectedRole?.permission_keys)
      ? selectedRole.permission_keys
      : []
  )
  const grantedPermissions = permissions.filter((permission) =>
    selectedKeys.has(permission.key)
  )
  const permissionGroups = groupPermissions(grantedPermissions)

  return (
    <AdminLayout
      title="角色权限"
      description="服务端角色绑定是真源；页面只把权限翻译成易读能力。"
      onRefresh={fetchOverview}
      refreshing={loading}
    >
      <AsyncState
        loading={loading}
        error={errMsg}
        hasData={roles.length > 0}
        empty={!loading && roles.length === 0}
        emptyTitle="还没有后台角色"
        emptyDescription="服务初始化后，内置超级管理员角色会出现在这里。"
        onRetry={fetchOverview}
      >
        <div className="admin-role-grid">
          <Card title="选择角色">
            <Select
              className="admin-role-select"
              aria-label="选择后台角色"
              value={selectedRoleKey || undefined}
              placeholder="选择角色"
              options={roles.map((role) => ({
                value: role.key,
                label: role.name,
              }))}
              onChange={setSelectedRoleKey}
            />
            <div className="admin-role-list">
              {roles.map((role) => (
                <button
                  type="button"
                  key={role.key}
                  className={`admin-role-list__item ${
                    role.key === selectedRoleKey
                      ? 'admin-role-list__item--active'
                      : ''
                  }`}
                  aria-pressed={role.key === selectedRoleKey}
                  onClick={() => setSelectedRoleKey(role.key)}
                >
                  <Typography.Text strong>{role.name}</Typography.Text>
                  <div className="admin-role-list__meta">
                    <span>{role.admin_count || 0} 位管理员</span>
                    <span>{role.builtin ? '模板内置' : '项目自定义'}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card
            title={selectedRole?.name || '角色能力'}
            extra={
              selectedRole ? (
                <Tag color={selectedRole.builtin ? 'blue' : 'default'}>
                  {selectedRole.builtin ? '内置角色' : '自定义角色'}
                </Tag>
              ) : null
            }
          >
            {selectedRole?.description ? (
              <Typography.Paragraph type="secondary">
                {selectedRole.description}
              </Typography.Paragraph>
            ) : null}
            {selectedRole ? (
              <details className="admin-role-technical">
                <summary>查看角色标识</summary>
                <Typography.Text code>{selectedRole.key}</Typography.Text>
              </details>
            ) : null}
            {Object.keys(permissionGroups).length > 0 ? (
              <div className="admin-permission-groups">
                {Object.entries(permissionGroups).map(([group, items]) => (
                  <section className="admin-permission-group" key={group}>
                    <Typography.Text strong>{group}</Typography.Text>
                    <div className="admin-permission-group__items">
                      {items.map((permission) => (
                        <div
                          className="admin-permission-item"
                          key={permission.key}
                        >
                          <Typography.Text>{permission.name}</Typography.Text>
                          <Typography.Text type="secondary">
                            {permission.description || '暂无补充说明'}
                          </Typography.Text>
                          <details>
                            <summary>查看权限码</summary>
                            <Typography.Text code>
                              {permission.key}
                            </Typography.Text>
                          </details>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">
                当前角色没有绑定可展示的权限。
              </Typography.Text>
            )}
          </Card>
        </div>
      </AsyncState>
    </AdminLayout>
  )
}
