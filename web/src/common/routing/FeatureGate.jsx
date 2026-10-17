import React from 'react'
import { Link } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { runtimeConfig } from '@/common/config/runtimeConfig.mjs'

export default function FeatureGate({ feature, name, children }) {
  if (runtimeConfig.features[feature]) return children

  return (
    <AppShell className="flex items-center justify-center px-5 py-12">
      <main className="app-surface w-full max-w-lg rounded-lg border p-8 text-center">
        <p className="app-muted text-sm font-medium">可选预设</p>
        <h1 className="mt-3 text-2xl font-semibold">{name}未启用</h1>
        <p className="app-muted mt-3 text-sm leading-6">
          当前部署没有启用此能力。派生项目需要先接入正式数据接口，再通过运行时配置开放入口。
        </p>
        <Link className="app-link mt-6 inline-block font-medium" to="/">
          返回首页
        </Link>
      </main>
    </AppShell>
  )
}
