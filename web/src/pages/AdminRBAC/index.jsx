import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Table, Tag, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { AUTH_SCOPE } from '@/common/auth/auth'
import { getActionErrorMessage } from '@/common/utils/errorMessage'

export default function AdminRBACPage() {
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

  const fetchOverview = useCallback(async () => {
    setErrMsg('')
    setLoading(true)
    try {
      const result = await rbacRpc.call('overview')
      const data = result?.data || result?.result?.data || {}
      setRoles(Array.isArray(data.roles) ? data.roles : [])
      setPermissions(Array.isArray(data.permissions) ? data.permissions : [])
    } catch (e) {
      setErrMsg(getActionErrorMessage(e, '获取角色权限'))
      setRoles([])
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [rbacRpc])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  const roleColumns = [
    {
      title: '角色',
      dataIndex: 'name',
      render: (value, row) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div>
            <Typography.Text type="secondary">{row.key}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: '管理员数',
      dataIndex: 'admin_count',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'builtin',
      width: 110,
      render: (builtin) =>
        builtin ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      minWidth: 260,
    },
  ]

  const permissionColumns = [
    {
      title: '权限码',
      dataIndex: 'key',
      width: 220,
      render: (value) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 160,
    },
    {
      title: '分组',
      dataIndex: 'group',
      width: 120,
      render: (value) => <Tag>{value || '默认'}</Tag>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      minWidth: 260,
    },
  ]

  return (
    <AdminLayout title="角色权限">
      <div className="admin-page-stack">
        {errMsg ? (
          <Card size="small">
            <Typography.Text type="danger">{errMsg}</Typography.Text>
          </Card>
        ) : null}

        <Card title="角色">
          <Table
            rowKey="key"
            columns={roleColumns}
            dataSource={roles}
            loading={loading}
            pagination={false}
            scroll={{ x: 760 }}
          />
        </Card>

        <Card title="权限码">
          <Table
            rowKey="key"
            columns={permissionColumns}
            dataSource={permissions}
            loading={loading}
            pagination={false}
            scroll={{ x: 860 }}
          />
        </Card>
      </div>
    </AdminLayout>
  )
}
