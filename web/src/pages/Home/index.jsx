import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import SurfacePanel from '@/common/components/layout/SurfacePanel'
import { AUTH_SCOPE, getCurrentUser, logout } from '@/common/auth/auth'

function SessionCard({
  badge,
  title,
  description,
  actions,
  accentClass,
  children = null,
}) {
  return (
    <SurfacePanel className="h-full p-5 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-3">
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${accentClass}`}
          >
            {badge}
          </div>
          <div className="space-y-2">
            <div className="text-xl font-semibold text-slate-50">{title}</div>
            <div className="text-sm leading-6 text-slate-300">
              {description}
            </div>
          </div>
          {children}
        </div>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
    </SurfacePanel>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  // 根首页默认感知两类登录态，方便派生项目替换成业务首页时继续沿用这套入口。
  const user = getCurrentUser(AUTH_SCOPE.USER)
  const admin = getCurrentUser(AUTH_SCOPE.ADMIN)

  const handleLogout = (scope, nextPath) => {
    logout(scope)
    navigate(nextPath, { replace: true })
  }

  return (
    <AppShell className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <SurfacePanel className="p-6 sm:p-8 lg:p-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
                  Starter Workspace
                </div>
                <div className="max-w-2xl space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl lg:text-5xl">
                    为新项目提供一个中性的鉴权起点
                  </h1>
                  <p className="text-sm leading-7 text-slate-300 sm:text-base">
                    模板默认保留用户登录、注册和管理员入口。初始化项目后，可以把这里替换成业务首页、工作台或首屏引导。
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-sm font-medium text-slate-100">
                    默认保留
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    登录、注册、会话保持、管理员登录、后台账号目录，以及最小健康检查和质量门禁骨架。
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-sm font-medium text-slate-100">
                    初始化后建议替换
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    项目名、业务首页、后台菜单、部署配置和任何模板示例文案。
                  </div>
                </div>
              </div>
            </div>
          </SurfacePanel>

          <div className="grid gap-6">
            <SessionCard
              badge="User Access"
              title={user ? `已登录：${user.username}` : '用户访问入口'}
              description={
                user
                  ? '用户会话已经建立。派生项目可以直接把这里替换为业务首页或个人工作台。'
                  : '默认保留账号登录和注册流程，适合作为大多数项目的通用起点。'
              }
              accentClass="border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
              actions={
                user
                  ? [
                    <button
                      key="user-logout"
                      type="button"
                      onClick={() => handleLogout(AUTH_SCOPE.USER, '/login')}
                      className="border-white/14 hover:bg-white/8 rounded-full border px-4 py-2 text-sm font-medium text-slate-100 transition"
                    >
                      退出用户登录
                    </button>,
                    ]
                  : [
                    <Link
                      key="user-login"
                      to="/login"
                      className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                    >
                      用户登录
                    </Link>,
                    <Link
                      key="user-register"
                      to="/register"
                      className="border-white/14 hover:bg-white/8 rounded-full border px-4 py-2 text-sm font-medium text-slate-100 transition"
                    >
                      注册账号
                    </Link>,
                    ]
              }
            >
              {user ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                  当前登录用户 ID：{user.id}
                </div>
              ) : null}
            </SessionCard>

            <SessionCard
              badge="Admin Access"
              title={admin ? `管理员：${admin.username}` : '管理控制台入口'}
              description={
                admin
                  ? '管理员会话已建立，可以继续进入后台控制台或在派生项目中替换为真实管理首页。'
                  : '如果项目包含后台管理能力，可继续沿用管理员登录、账号目录和项目收口入口。'
              }
              accentClass="border-amber-300/30 bg-amber-300/10 text-amber-100"
              actions={
                admin
                  ? [
                    <Link
                      key="admin-console"
                      to="/admin-menu"
                      className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
                    >
                      进入管理控制台
                    </Link>,
                    <button
                      key="admin-logout"
                      type="button"
                      onClick={() =>
                          handleLogout(AUTH_SCOPE.ADMIN, '/admin-login')
                        }
                      className="border-white/14 hover:bg-white/8 rounded-full border px-4 py-2 text-sm font-medium text-slate-100 transition"
                    >
                      退出管理员登录
                    </button>,
                    ]
                  : [
                    <Link
                      key="admin-login"
                      to="/admin-login"
                      className="border-white/14 hover:bg-white/8 rounded-full border px-4 py-2 text-sm font-medium text-slate-100 transition"
                    >
                      管理员登录
                    </Link>,
                    ]
              }
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
