import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  LogoutOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Modal, Space, Typography } from 'antd'
import {
  AUTH_SCOPE,
  logout,
  updateAuthMeta,
  useCurrentUser,
} from '@/common/auth/auth'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { JsonRpc } from '@/common/utils/jsonRpc'
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
} from '@/common/consts/adminPermissions'
import { isAuthFailureCode } from '@/common/consts/errorCodes'
import './adminLayout.css'

const { Header, Sider, Content } = Layout

const NAV_ITEMS = [
  {
    key: '/admin-menu',
    icon: <AppstoreOutlined />,
    label: '控制台',
  },
  {
    key: '/admin-accounts',
    icon: <TeamOutlined />,
    label: '账号目录',
    permission: ADMIN_PERMISSIONS.USER_READ,
  },
  {
    key: '/admin-rbac',
    icon: <SafetyOutlined />,
    label: '角色权限',
    permission: ADMIN_PERMISSIONS.RBAC_READ,
  },
]

function getSelectedKey(pathname) {
  if (pathname.startsWith('/admin-accounts')) return '/admin-accounts'
  if (pathname.startsWith('/admin-rbac')) return '/admin-rbac'
  return '/admin-menu'
}

export default function AdminLayout({ title, description, children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const admin = useCurrentUser(AUTH_SCOPE.ADMIN)
  const authRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'auth',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  useEffect(() => {
    if (!admin || admin.role !== 'admin' || admin.permissions.length > 0) {
      return
    }

    let cancelled = false
    // 兼容修复前已写入本地的管理员 token：token 仍有效但缺少权限快照时，从服务端真源回补。
    authRpc
      .call('me')
      .then((result) => {
        if (!cancelled) {
          updateAuthMeta(result?.data, AUTH_SCOPE.ADMIN)
        }
      })
      .catch((e) => {
        if (isAuthFailureCode(e?.code)) {
          logout(AUTH_SCOPE.ADMIN)
          navigate('/admin-login', { replace: true, state: { from: location } })
          return
        }
        console.warn('刷新管理员权限失败', e)
      })

    return () => {
      cancelled = true
    }
  }, [admin, authRpc, location, navigate])

  const menuItems = NAV_ITEMS.filter((item) =>
    hasAdminPermission(admin, item.permission)
  )

  const handleLogout = async () => {
    try {
      await authRpc.call('logout')
    } catch (e) {
      console.warn('服务器 logout 失败', e)
    } finally {
      setLogoutOpen(false)
      logout(AUTH_SCOPE.ADMIN)
      navigate('/admin-login', { replace: true })
    }
  }

  return (
    <Layout className="admin-shell">
      <Sider
        className="admin-shell__sider"
        breakpoint="lg"
        collapsedWidth={0}
        width={276}
      >
        <div className="admin-shell__brand">
          <div className="admin-shell__brand-mark">W</div>
          <div>
            <div className="admin-shell__brand-name">Admin Preset</div>
            <div className="admin-shell__brand-subtitle">basic RBAC</div>
          </div>
        </div>
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[getSelectedKey(location.pathname)]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout className="admin-shell__main">
        <Header className="admin-shell__header">
          <div className="admin-shell__title-block">
            <Typography.Text strong>{title}</Typography.Text>
          </div>
          <Space>
            <Typography.Text className="admin-shell__user">
              {admin?.username || 'admin'}
            </Typography.Text>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => setLogoutOpen(true)}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="admin-shell__content">
          <div className="admin-shell__page-heading">
            <Typography.Title level={3}>{title}</Typography.Title>
            {description ? (
              <Typography.Text type="secondary">{description}</Typography.Text>
            ) : null}
          </div>
          {children}
        </Content>
      </Layout>
      <Modal
        title="退出管理员登录"
        open={logoutOpen}
        okText="退出"
        cancelText="取消"
        onOk={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      >
        确认退出当前管理员账号吗？
      </Modal>
    </Layout>
  )
}
