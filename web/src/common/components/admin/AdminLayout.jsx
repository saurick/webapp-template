import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  LogoutOutlined,
  MenuOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Button,
  Drawer,
  Dropdown,
  Grid,
  Layout,
  Menu,
  Modal,
  Space,
  Typography,
} from 'antd'
import {
  AUTH_SCOPE,
  logout,
  updateAuthMeta,
  useCurrentUser,
} from '@/common/auth/auth'
import { runtimeConfig } from '@/common/config/runtimeConfig.mjs'
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
} from '@/common/consts/adminPermissions'
import ThemeToggle from '@/common/theme/ThemeToggle'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { isAuthFailureCode } from '@/common/consts/errorCodes'
import { JsonRpc } from '@/common/utils/jsonRpc'
import './adminLayout.css'

const { Header, Sider, Content } = Layout

const BASE_NAV_ITEMS = [
  {
    key: '/admin-menu',
    icon: <AppstoreOutlined />,
    label: '工作台',
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
  {
    key: '/admin-guide',
    icon: <QuestionCircleOutlined />,
    label: '使用说明',
    feature: 'adminGuide',
  },
]

function getSelectedKey(pathname) {
  const matched = BASE_NAV_ITEMS.find(
    (item) => item.key !== '/admin-menu' && pathname.startsWith(item.key)
  )
  return matched?.key || '/admin-menu'
}

export default function AdminLayout({
  title,
  description = '',
  onRefresh,
  refreshing = false,
  children,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const desktop = Boolean(screens.lg)
  const [drawerOpen, setDrawerOpen] = useState(false)
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
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!admin || admin.role !== 'admin' || admin.permissions.length > 0) {
      return undefined
    }

    let cancelled = false
    // 兼容修复前已写入本地的管理员 token：token 仍有效但缺少权限快照时，从服务端真源回补。
    authRpc
      .call('me')
      .then((result) => {
        if (!cancelled) updateAuthMeta(result?.data, AUTH_SCOPE.ADMIN)
      })
      .catch((error) => {
        if (isAuthFailureCode(error?.code)) {
          logout(AUTH_SCOPE.ADMIN)
          navigate('/admin-login', { replace: true, state: { from: location } })
          return
        }
        console.warn('刷新管理员权限失败', error)
      })

    return () => {
      cancelled = true
    }
  }, [admin, authRpc, location, navigate])

  const menuItems = BASE_NAV_ITEMS.filter((item) => {
    if (item.feature && !runtimeConfig.features[item.feature]) return false
    return hasAdminPermission(admin, item.permission)
  })

  const handleLogout = async () => {
    try {
      await authRpc.call('logout')
    } catch (error) {
      console.warn('服务器 logout 失败', error)
    } finally {
      setLogoutOpen(false)
      logout(AUTH_SCOPE.ADMIN)
      navigate('/admin-login', { replace: true })
    }
  }

  const navigation = (
    <Menu
      mode="inline"
      selectedKeys={[getSelectedKey(location.pathname)]}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
    />
  )

  const brand = (
    <div className="admin-shell__brand">
      <div className="admin-shell__brand-mark" aria-hidden="true">
        <SafetyOutlined />
      </div>
      <div className="admin-shell__brand-copy">
        <div className="admin-shell__brand-name">
          {runtimeConfig.branding.adminName}
        </div>
        <div className="admin-shell__brand-subtitle">
          {runtimeConfig.branding.adminSubtitle}
        </div>
      </div>
    </div>
  )

  return (
    <Layout className="admin-shell">
      {desktop ? (
        <Sider className="admin-shell__sider" width={248}>
          {brand}
          {navigation}
        </Sider>
      ) : null}
      <Drawer
        className="admin-shell__drawer"
        size={280}
        placement="left"
        open={!desktop && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={brand}
      >
        {navigation}
      </Drawer>
      <Layout className="admin-shell__main">
        <Header className="admin-shell__header">
          <div className="admin-shell__heading-row">
            {!desktop ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                aria-label="打开后台导航"
                onClick={() => setDrawerOpen(true)}
              />
            ) : null}
            <div className="admin-shell__title-block">
              <Typography.Title level={4}>{title}</Typography.Title>
              {description ? (
                <Typography.Text type="secondary">
                  {description}
                </Typography.Text>
              ) : null}
            </div>
          </div>
          <Space wrap className="admin-shell__actions">
            {onRefresh ? (
              <Button
                icon={<ReloadOutlined />}
                loading={refreshing}
                onClick={onRefresh}
              >
                刷新
              </Button>
            ) : null}
            <ThemeToggle compact />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') setLogoutOpen(true)
                },
              }}
            >
              <Button icon={<UserOutlined />}>
                <span className="admin-shell__user">
                  {admin?.username || 'admin'}
                </span>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content className="admin-shell__content">{children}</Content>
      </Layout>
      <Modal
        title="退出管理员登录"
        open={logoutOpen}
        okText="退出"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onOk={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      >
        确认退出当前管理员账号吗？
      </Modal>
    </Layout>
  )
}
