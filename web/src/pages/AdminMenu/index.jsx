import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Col, Row, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'

const ENTRIES = [
  {
    title: '账号目录',
    path: '/admin-accounts',
  },
  {
    title: '角色权限',
    path: '/admin-rbac',
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
              <Card hoverable onClick={() => navigate(entry.path)}>
                <Typography.Title level={4}>{entry.title}</Typography.Title>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </AdminLayout>
  )
}
