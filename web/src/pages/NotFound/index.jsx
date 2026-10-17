import React from 'react'
import { Link } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'

export default function NotFoundPage() {
  return (
    <AppShell className="flex items-center justify-center px-5 py-12">
      <main className="app-surface w-full max-w-lg rounded-lg border p-8 text-center">
        <p className="app-muted text-sm font-medium">404</p>
        <h1 className="mt-3 text-2xl font-semibold">没有找到这个页面</h1>
        <p className="app-muted mt-3 text-sm leading-6">
          请检查地址，或回到首页重新选择入口。
        </p>
        <Link className="app-link mt-6 inline-block font-medium" to="/">
          返回首页
        </Link>
      </main>
    </AppShell>
  )
}
