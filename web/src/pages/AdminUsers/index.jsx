import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Input,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import AdminLayout from '@/common/components/admin/AdminLayout'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { AUTH_SCOPE, useCurrentUser } from '@/common/auth/auth'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
} from '@/common/consts/adminPermissions'

const PAGE_SIZE = 30

function fmtTs(ts) {
  if (!ts) return '-'
  const d = new Date(Number(ts) * 1000)
  if (Number.isNaN(d.getTime())) return String(ts)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function clampInt(v, fallback = 0) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function clampInt64(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export default function AdminUsersPage() {
  const admin = useCurrentUser(AUTH_SCOPE.ADMIN)
  const canWriteUser = hasAdminPermission(admin, ADMIN_PERMISSIONS.USER_WRITE)
  const userRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'user',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [searchName, setSearchName] = useState('')

  const fetchList = useCallback(
    async (targetPage = page, keyword = searchName) => {
      setErrMsg('')
      setLoading(true)
      try {
        const safePage = Math.max(1, clampInt(targetPage, 1))
        const offset = (safePage - 1) * PAGE_SIZE
        const trimmedKeyword = (keyword || '').trim()

        // 模板 admin preset 默认只保留账号目录的通用字段，业务字段留给派生项目扩展。
        const result = await userRpc.call('list', {
          limit: PAGE_SIZE,
          offset,
          search: trimmedKeyword,
        })

        const data = result?.data || result?.result?.data || {}
        const list = Array.isArray(data?.users) ? data.users : []
        const nextTotal = clampInt64(data?.total, 0)

        setItems(list)
        setTotal(nextTotal)
        setPage(safePage)
      } catch (e) {
        setErrMsg(getActionErrorMessage(e, '获取用户列表'))
        setItems([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [page, searchName, userRpc]
  )

  useEffect(() => {
    fetchList(page, searchName)
  }, [fetchList, page, searchName])

  const onSearch = () => {
    const keyword = (searchInput || '').trim()
    setPage(1)
    setSearchName(keyword)
    if (page === 1 && keyword === searchName) {
      fetchList(1, keyword)
    }
  }

  const onClearSearch = () => {
    setSearchInput('')
    setSearchName('')
    setPage(1)
    if (page === 1 && !searchName) {
      fetchList(1, '')
    }
  }

  const setDisabled = async (userId, disabled) => {
    setErrMsg('')
    try {
      await userRpc.call('set_disabled', {
        user_id: userId,
        disabled: !!disabled,
      })
      await fetchList(page, searchName)
    } catch (e) {
      setErrMsg(getActionErrorMessage(e, '更新用户状态'))
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 64,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      width: 150,
      render: (value) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 96,
      render: (_, row) => {
        const name = String(row.username || '')
        if (name.includes('admin')) return <Tag color="green">管理员</Tag>
        if (name.includes('ops')) return <Tag color="blue">运维</Tag>
        return <Tag>用户</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      width: 90,
      render: (disabled) =>
        disabled ? <Tag color="red">禁用</Tag> : <Tag color="green">启用</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 130,
      render: fmtTs,
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      width: 130,
      render: fmtTs,
    },
    {
      title: '操作',
      dataIndex: 'disabled',
      width: 110,
      render: (disabled, row) => (
        <Switch
          checked={!disabled}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          disabled={!canWriteUser}
          onChange={(checked) => setDisabled(row.id, !checked)}
        />
      ),
    },
  ]

  return (
    <AdminLayout title="账号目录">
      <div className="admin-page-stack">
        {errMsg ? (
          <Card size="small">
            <Typography.Text type="danger">{errMsg}</Typography.Text>
          </Card>
        ) : null}

        <Card
          className="admin-table-card"
          title="账号列表"
          extra={
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => fetchList(page, searchName)}
            >
              刷新
            </Button>
          }
        >
          <div className="mb-4">
            <Space wrap>
              <Input
                allowClear
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={onSearch}
                placeholder="搜索用户名"
                style={{ width: 240 }}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={loading}
                onClick={onSearch}
              >
                搜索
              </Button>
              <Button onClick={onClearSearch} disabled={loading}>
                清空
              </Button>
            </Space>
          </div>
          <Table
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={items}
            loading={loading}
            scroll={{ x: 820 }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              showSizeChanger: false,
              showTotal: (value) => `共 ${value} 条`,
              onChange: (nextPage) => setPage(nextPage),
            }}
          />
        </Card>
      </div>
    </AdminLayout>
  )
}
