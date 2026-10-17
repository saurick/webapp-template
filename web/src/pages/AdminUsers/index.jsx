import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Input,
  Modal,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'
import AsyncState from '@/common/components/state/AsyncState'
import { AUTH_SCOPE, useCurrentUser } from '@/common/auth/auth'
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
} from '@/common/consts/adminPermissions'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'

const PAGE_SIZE = 30

function fmtTs(ts) {
  if (!ts) return '暂无记录'
  const date = new Date(Number(ts) * 1000)
  if (Number.isNaN(date.getTime())) return '时间格式异常'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function positiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function safeTotal(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0
}

export default function AdminUsersPage() {
  const admin = useCurrentUser(AUTH_SCOPE.ADMIN)
  const canWriteUser = hasAdminPermission(admin, ADMIN_PERMISSIONS.USER_WRITE)
  const [searchParams, setSearchParams] = useSearchParams()
  const page = positiveInt(searchParams.get('page'))
  const searchName = (searchParams.get('q') || '').trim()
  const requestSequence = useRef(0)
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
  const [searchInput, setSearchInput] = useState(searchName)
  const [updatingId, setUpdatingId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)

  useEffect(() => {
    setSearchInput(searchName)
  }, [searchName])

  const fetchList = useCallback(async () => {
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    setErrMsg('')
    setLoading(true)
    try {
      const result = await userRpc.call('list', {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: searchName,
      })
      if (sequence !== requestSequence.current) return

      const data = result?.data || result?.result?.data || {}
      setItems(Array.isArray(data.users) ? data.users : [])
      setTotal(safeTotal(data.total))
    } catch (error) {
      if (sequence !== requestSequence.current) return
      setErrMsg(getActionErrorMessage(error, '获取用户列表'))
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [page, searchName, userRpc])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const updateQuery = (nextPage, nextKeyword) => {
    const next = new URLSearchParams()
    const keyword = String(nextKeyword || '').trim()
    if (keyword) next.set('q', keyword)
    if (nextPage > 1) next.set('page', String(nextPage))
    setSearchParams(next)
  }

  const handleSearch = () => {
    const keyword = searchInput.trim()
    if (page === 1 && keyword === searchName) {
      fetchList()
      return
    }
    updateQuery(1, keyword)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    if (page === 1 && !searchName) {
      fetchList()
      return
    }
    updateQuery(1, '')
  }

  const applyStatusChange = async () => {
    if (!confirmTarget) return
    const { id, username, nextDisabled } = confirmTarget
    setConfirmTarget(null)
    setErrMsg('')
    setUpdatingId(id)
    try {
      const result = await userRpc.call('set_disabled', {
        user_id: id,
        disabled: nextDisabled,
      })
      const data = result?.data || result?.result?.data || {}
      const confirmedDisabled =
        typeof data.disabled === 'boolean' ? data.disabled : nextDisabled
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, disabled: confirmedDisabled } : item
        )
      )
    } catch (error) {
      setErrMsg(
        getActionErrorMessage(
          error,
          `${nextDisabled ? '禁用' : '启用'}账号 ${username}`
        )
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const columns = [
    {
      title: '账号',
      dataIndex: 'username',
      minWidth: 180,
      render: (value, row) => (
        <div>
          <Typography.Text strong>{value}</Typography.Text>
          <div>
            <Typography.Text type="secondary">编号 {row.id}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      width: 100,
      render: (disabled) =>
        disabled ? (
          <Tag color="red">已禁用</Tag>
        ) : (
          <Tag color="green">可登录</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 150,
      responsive: ['md'],
      render: fmtTs,
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      width: 150,
      responsive: ['lg'],
      render: fmtTs,
    },
    {
      title: '允许登录',
      dataIndex: 'disabled',
      width: 120,
      render: (disabled, row) => (
        <Switch
          aria-label={`${row.username} 允许登录`}
          checked={!disabled}
          checkedChildren="允许"
          unCheckedChildren="禁止"
          loading={updatingId === row.id}
          disabled={!canWriteUser || updatingId !== null}
          onChange={(checked) =>
            setConfirmTarget({
              id: row.id,
              username: row.username,
              nextDisabled: !checked,
            })
          }
        />
      ),
    },
  ]

  return (
    <AdminLayout
      title="账号目录"
      description="普通用户账号不带虚构角色；角色权限仅属于管理员体系。"
      onRefresh={fetchList}
      refreshing={loading}
    >
      <Card className="admin-table-card" title="账号列表">
        <div className="admin-toolbar">
          <div className="admin-toolbar__filters">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onPressEnter={handleSearch}
              placeholder="按用户名搜索"
            />
            <Button type="primary" loading={loading} onClick={handleSearch}>
              搜索
            </Button>
            <Button disabled={loading} onClick={handleClearSearch}>
              清空
            </Button>
          </div>
          {!canWriteUser ? (
            <Typography.Text type="secondary">当前账号仅可查看</Typography.Text>
          ) : null}
        </div>
        <AsyncState
          loading={loading}
          error={errMsg}
          hasData={items.length > 0}
          empty={!loading && items.length === 0}
          emptyTitle={searchName ? '没有匹配的账号' : '还没有用户账号'}
          emptyDescription={
            searchName
              ? '请调整搜索条件后重试。'
              : '用户完成注册后会出现在这里。'
          }
          onRetry={fetchList}
        >
          <Table
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={items}
            loading={loading}
            scroll={{ x: 620 }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              showSizeChanger: false,
              showTotal: (value) => `共 ${value} 条`,
              onChange: (nextPage) => updateQuery(nextPage, searchName),
            }}
          />
        </AsyncState>
      </Card>
      <Modal
        title={confirmTarget?.nextDisabled ? '禁用账号' : '启用账号'}
        open={Boolean(confirmTarget)}
        okText={confirmTarget?.nextDisabled ? '确认禁用' : '确认启用'}
        cancelText="取消"
        okButtonProps={{ danger: Boolean(confirmTarget?.nextDisabled) }}
        onOk={applyStatusChange}
        onCancel={() => setConfirmTarget(null)}
      >
        {confirmTarget?.nextDisabled
          ? `禁用后，账号“${confirmTarget.username}”将无法登录。`
          : `启用后，账号“${confirmTarget?.username || ''}”可以重新登录。`}
      </Modal>
    </AdminLayout>
  )
}
