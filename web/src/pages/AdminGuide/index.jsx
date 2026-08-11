import React from 'react'
import { Alert, Card, Tag, Typography } from 'antd'
import AdminLayout from '@/common/components/admin/AdminLayout'
import {
  OPTIONAL_EXTENSION_DEFINITIONS,
  runtimeConfig,
} from '@/common/config/runtimeConfig.mjs'

export default function AdminGuidePage() {
  return (
    <AdminLayout
      title="使用说明"
      description="模板只提供通用边界；派生项目需要接入自己的业务真源。"
    >
      <div className="admin-page-stack">
        <Alert
          showIcon
          type="info"
          title="前端开关不等于权限"
          description="菜单和按钮用于降低操作干扰，服务端权限校验始终是最终授权边界。"
        />
        <Card title="后台基础能力">
          <Typography.Paragraph>
            当前 preset
            包含独立管理员登录、账号目录、角色权限概览、响应式导航、主题切换以及统一的加载、空数据、失败重试状态。
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            多租户、组织树、数据权限、审批流和行业角色不属于模板默认能力，需要派生项目按真实
            schema、接口和测试实现。
          </Typography.Paragraph>
        </Card>
        <Card title="可选扩展合同">
          <div className="admin-extension-list">
            {OPTIONAL_EXTENSION_DEFINITIONS.map((extension) => {
              const enabled = runtimeConfig.features[extension.key]
              return (
                <div className="admin-extension-item" key={extension.key}>
                  <Typography.Text strong>{extension.name}</Typography.Text>
                  <Typography.Text
                    type="secondary"
                    className="admin-extension-item__boundary"
                  >
                    {extension.boundary}
                  </Typography.Text>
                  <Tag color={enabled ? 'green' : 'default'}>
                    {enabled ? '已启用' : '未启用'}
                  </Tag>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}
