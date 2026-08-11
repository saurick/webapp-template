import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AUTH_SCOPE, getCurrentUser, logout } from '@/common/auth/auth'
import AppShell from '@/common/components/layout/AppShell'
import {
  resolveProductName,
  runtimeConfig,
} from '@/common/config/runtimeConfig.mjs'
import ThemeToggle from '@/common/theme/ThemeToggle'

export default function HomePage() {
  const navigate = useNavigate()
  // 前台首页只处理普通用户登录态，管理员入口固定走 /admin-login。
  const user = getCurrentUser(AUTH_SCOPE.USER)
  const username = user?.username || '访客'
  const productName = resolveProductName(
    runtimeConfig,
    import.meta.env.VITE_APP_TITLE
  )

  const handleLogout = () => {
    logout(AUTH_SCOPE.USER)
    navigate('/login', { replace: true })
  }

  return (
    <AppShell>
      <header className="border-b border-[var(--app-border)] bg-[var(--app-surface)]">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-2">
          <Link to="/" className="text-lg font-semibold text-[var(--app-text)]">
            {productName}
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="app-secondary-button min-h-10 rounded-md px-3 text-sm"
              >
                退出
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="app-primary-button inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="app-secondary-button inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium"
                >
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="app-surface flex min-h-[260px] flex-col justify-between rounded-lg border p-7">
          <div>
            <p className="app-muted text-sm font-medium">
              {user ? '当前普通用户' : '未登录访客'}
            </p>
            <h1
              aria-label={`欢迎回来，${username}`}
              className="mt-3 max-w-[12ch] text-4xl font-semibold leading-tight"
            >
              欢迎回来，{username}
            </h1>
          </div>
          <div className="h-1 w-16 rounded-full bg-[var(--app-primary)]" />
        </section>

        <section className="app-surface rounded-lg border p-6">
          <p className="app-muted text-sm font-medium">工作区</p>
          <h2 className="mt-2 text-xl font-semibold">
            {user ? '选择已启用的工作入口' : '登录后进入项目工作区'}
          </h2>
          <p className="app-muted mt-3 max-w-xl text-sm leading-7">
            模板不展示虚构的最近活动、统计数字或业务单据。派生项目应从自己的正式接口接入真实内容。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {runtimeConfig.features.mobileWorkQueue ? (
              <Link
                to="/work-queue"
                className="app-primary-button inline-flex min-h-11 items-center rounded-md px-5 text-sm font-medium"
              >
                打开移动工作队列
              </Link>
            ) : null}
            {!user ? (
              <Link
                to="/login"
                className="app-secondary-button inline-flex min-h-11 items-center rounded-md px-5 text-sm font-medium"
              >
                用户登录
              </Link>
            ) : null}
          </div>
          {user && !runtimeConfig.features.mobileWorkQueue ? (
            <div className="mt-7 rounded-md border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-5 text-sm text-[var(--app-text-muted)]">
              当前部署尚未配置用户端业务模块。
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  )
}
