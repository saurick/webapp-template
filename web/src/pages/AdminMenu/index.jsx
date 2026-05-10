import React from 'react'
import { useNavigate } from 'react-router-dom'
import { SafetyOutlined, TeamOutlined } from '@ant-design/icons'
import { Card, Col, Row, Statistic, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'
import { AUTH_SCOPE, useCurrentUser } from '@/common/auth/auth'
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
} from '@/common/consts/adminPermissions'

const ENTRY_CARDS = [
  {
    title: '账号目录',
    description: '查看普通用户，执行启用或禁用等基础账号操作。',
    path: '/admin-accounts',
    icon: <TeamOutlined />,
    permission: ADMIN_PERMISSIONS.USER_READ,
  },
  {
    title: '角色权限',
    description: '查看模板内置角色、权限码和 basic RBAC 默认绑定。',
    path: '/admin-rbac',
    icon: <SafetyOutlined />,
    permission: ADMIN_PERMISSIONS.RBAC_READ,
  },
]

export default function AdminMenuPage() {
  const navigate = useNavigate()
  const admin = useCurrentUser(AUTH_SCOPE.ADMIN)
  const visibleEntries = ENTRY_CARDS.filter((item) =>
    hasAdminPermission(admin, item.permission)
  )

  return (
    <AdminLayout
      title="管理控制台"
      description="当前模板按 admin preset 提供简约后台与 basic RBAC 基线。"
    >
      <div className="admin-page-stack">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="当前角色" value={admin?.roles?.[0] || '-'} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="权限数量"
                value={admin?.permissions?.length || 0}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="后台形态" value="admin preset" />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {visibleEntries.map((entry) => (
            <Col xs={24} md={12} xl={8} key={entry.path}>
              <Card
                hoverable
                onClick={() => navigate(entry.path)}
                title={
                  <span className="inline-flex items-center gap-2">
                    {entry.icon}
                    {entry.title}
                  </span>
                }
              >
                <Typography.Paragraph type="secondary">
                  {entry.description}
                </Typography.Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </AdminLayout>
  )
}
