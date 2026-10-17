import React from 'react'
import AppShell from '@/common/components/layout/AppShell'

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    const { children } = this.props
    if (!error) return children

    return (
      <AppShell className="flex items-center justify-center px-5 py-12">
        <main className="app-surface w-full max-w-lg rounded-lg border p-8 text-center">
          <p className="app-muted text-sm font-medium">页面资源加载失败</p>
          <h1 className="mt-3 text-2xl font-semibold">暂时无法打开此页面</h1>
          <p className="app-muted mt-3 text-sm leading-6">
            可能是网络中断或页面版本已经更新。刷新后会重新获取最新资源。
          </p>
          <button
            type="button"
            className="app-primary-button mt-6 rounded-md px-5 py-3 text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </main>
      </AppShell>
    )
  }
}
