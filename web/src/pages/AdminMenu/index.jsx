import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'

const ENTRIES = [
  {
    title: '账号目录',
    path: '/admin-accounts',
    icon: <TeamOutlined />,
  },
  {
    title: '角色权限',
    path: '/admin-rbac',
    icon: <SafetyOutlined />,
  },
]

export default function AdminMenuPage() {
  const navigate = useNavigate()

  return (
    <AdminLayout title="管理控制台">
      <div className="admin-page-stack">
        <Row gutter={[14, 14]}>
          {ENTRIES.map((entry) => (
            <Col xs={24} md={12} key={entry.path}>
              <Card
                className="admin-entry-card"
                hoverable
                onClick={() => navigate(entry.path)}
              >
                <span className="admin-entry-card__icon">{entry.icon}</span>
                <Typography.Title level={4}>{entry.title}</Typography.Title>
                <ArrowRightOutlined className="admin-entry-card__arrow" />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </AdminLayout>
  )
}
