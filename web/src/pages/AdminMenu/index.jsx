import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightOutlined,
  QuestionCircleOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Card, Col, Row, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'
import { AUTH_SCOPE, useCurrentUser } from '@/common/auth/auth'
import { runtimeConfig } from '@/common/config/runtimeConfig.mjs'
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
} from '@/common/consts/adminPermissions'

const BASE_ENTRIES = [
  {
    title: '账号目录',
    description: '查找普通用户账号，并在授权范围内启用或禁用账号。',
    action: '管理账号',
    path: '/admin-accounts',
    icon: <TeamOutlined />,
    permission: ADMIN_PERMISSIONS.USER_READ,
  },
  {
    title: '角色权限',
    description: '用业务名称查看角色拥有哪些能力，权限码仅作为技术明细。',
    action: '查看权限',
    path: '/admin-rbac',
    icon: <SafetyOutlined />,
    permission: ADMIN_PERMISSIONS.RBAC_READ,
  },
  {
    title: '使用说明',
    description: '查看后台边界、启用方式和可选扩展的接入条件。',
    action: '查看说明',
    path: '/admin-guide',
    icon: <QuestionCircleOutlined />,
    feature: 'adminGuide',
  },
]

export default function AdminMenuPage() {
  const admin = useCurrentUser(AUTH_SCOPE.ADMIN)
  const entries = BASE_ENTRIES.filter((entry) => {
    if (entry.feature && !runtimeConfig.features[entry.feature]) return false
    return hasAdminPermission(admin, entry.permission)
  })

  return (
    <AdminLayout
      title="管理工作台"
      description="从当前需要处理的模块进入，不展示没有真源的统计数字。"
    >
      <div className="admin-page-stack">
        {entries.length === 0 ? (
          <Alert
            showIcon
            type="info"
            title="当前账号没有可用模块"
            description="请联系管理员核对服务端角色权限绑定。"
          />
        ) : (
          <Row gutter={[14, 14]}>
            {entries.map((entry) => (
              <Col xs={24} md={12} key={entry.path}>
                <Link className="admin-entry-link" to={entry.path}>
                  <Card className="admin-entry-card" hoverable>
                    <span className="admin-entry-card__icon">{entry.icon}</span>
                    <div>
                      <Typography.Title level={4}>
                        {entry.title}
                      </Typography.Title>
                      <Typography.Text
                        type="secondary"
                        className="admin-entry-card__description"
                      >
                        {entry.description}
                      </Typography.Text>
                    </div>
                    <span className="admin-entry-card__action">
                      {entry.action} <ArrowRightOutlined />
                    </span>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </AdminLayout>
  )
}
