import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, getCurrentUser, logout } from '@/common/auth/auth'

function SessionCard({
  eyebrow,
  title,
  description,
  actions,
  accentClass,
  accentTextClass,
  children = null,
}) {
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-[#d8e7e2] bg-white p-5 shadow-[0_10px_24px_rgba(31,58,77,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-[#bfd7cd] sm:p-6">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClass}`}
      />
      <div className="flex h-full flex-col justify-between gap-5">
        <div className="space-y-3">
          <div className={`text-xs font-semibold ${accentTextClass}`}>
            {eyebrow}
          </div>
          <div className="space-y-2.5">
            <h2 className="text-2xl font-semibold leading-tight text-[#172b3f]">
              {title}
            </h2>
            <p className="text-sm leading-6 text-[#6d7780]">{description}</p>
          </div>
          {children ? <div className="pt-1">{children}</div> : null}
        </div>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  )
}

function FeatureItem({ label, text }) {
  return (
    <div className="rounded-xl border border-[#e2ebe7] bg-[#f7faf8] p-4">
      <div className="text-sm font-semibold text-[#172b3f]">{label}</div>
      <p className="mt-2 text-sm leading-6 text-[#6d7780]">{text}</p>
    </div>
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
    <AppShell className="px-4 sm:px-6 lg:px-8">
      <main className="mx-auto flex min-h-screen max-w-7xl items-center py-8 sm:py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-stretch">
          <section className="relative overflow-hidden rounded-2xl border border-[#d8e5e8] bg-white p-6 shadow-[0_16px_34px_rgba(31,58,77,0.1)] sm:p-8 lg:p-10">
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div className="space-y-6">
                <div className="inline-flex w-fit rounded-md border border-[#d7e5df] bg-[#f4faf6] px-3 py-1 text-xs font-semibold text-[#2b8a4b]">
                  Webapp Template
                </div>
                <div className="max-w-3xl space-y-5">
                  <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] text-[#173957] sm:text-5xl lg:text-6xl">
                    清晰的账号入口，从这里开始
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-[#6d7780] sm:text-lg">
                    首页保留用户、注册与管理后台两条主路径，适合作为初始化后的临时起点；业务首页就绪后，可直接替换这里的展示内容。
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <FeatureItem
                  label="用户流程"
                  text="首次注册后自动登录，方便快速验证前台账号链路。"
                />
                <FeatureItem
                  label="后台入口"
                  text="管理员入口独立展示，前后台登录态互不干扰。"
                />
                <FeatureItem
                  label="可替换首页"
                  text="项目名、菜单和首屏内容按业务初始化后收口。"
                />
              </div>
            </div>
          </section>

          <div className="grid gap-6">
            <SessionCard
              eyebrow="用户入口"
              title={user ? `已登录：${user.username}` : '用户登录 / 注册'}
              description={
                user
                  ? '当前用户已登录，可以继续进入业务首页、个人中心或工作台。'
                  : '普通用户默认没有预置账号，首次使用请先注册；注册成功后会自动登录。'
              }
              accentClass="from-[#2e9449] via-[#dba640] to-transparent"
              accentTextClass="text-[#2b8a4b]"
              actions={
                user
                  ? [
                    <button
                      key="user-logout"
                      type="button"
                      onClick={() => handleLogout(AUTH_SCOPE.USER, '/login')}
                      className="rounded-md border border-[#d8e5e8] px-4 py-2.5 text-sm font-semibold text-[#173957] transition hover:bg-[#f4faf6]"
                    >
                      退出用户登录
                    </button>,
                    ]
                  : [
                    <Link
                      key="user-login"
                      to="/login"
                      className="rounded-md bg-[#2f9348] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,147,72,0.22)] transition hover:bg-[#267d3c]"
                    >
                      用户登录
                    </Link>,
                    <Link
                      key="user-register"
                      to="/register"
                      className="rounded-md border border-[#d8e5e8] px-5 py-2.5 text-sm font-semibold text-[#173957] transition hover:bg-[#f4faf6]"
                    >
                      注册账号
                    </Link>,
                    ]
              }
            >
              {user ? (
                <div className="rounded-xl border border-[#e2ebe7] bg-[#f7faf8] px-4 py-3 text-sm text-[#6d7780]">
                  当前登录用户 ID：{user.id}
                </div>
              ) : null}
            </SessionCard>

            <SessionCard
              eyebrow="管理入口"
              title={admin ? `管理员：${admin.username}` : '管理控制台'}
              description={
                admin
                  ? '管理员已登录，可以继续进入后台控制台。'
                  : '管理员通过独立入口登录，用于访问后台控制台和账号管理。'
              }
              accentClass="from-[#dba640] via-[#2f9348] to-transparent"
              accentTextClass="text-[#b7791f]"
              actions={
                admin
                  ? [
                    <Link
                      key="admin-console"
                      to="/admin-menu"
                      className="rounded-md bg-[#2f9348] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,147,72,0.22)] transition hover:bg-[#267d3c]"
                    >
                      进入管理控制台
                    </Link>,
                    <button
                      key="admin-logout"
                      type="button"
                      onClick={() =>
                          handleLogout(AUTH_SCOPE.ADMIN, '/admin-login')
                        }
                      className="rounded-md border border-[#d8e5e8] px-5 py-2.5 text-sm font-semibold text-[#173957] transition hover:bg-[#f4faf6]"
                    >
                      退出管理员登录
                    </button>,
                    ]
                  : [
                    <Link
                      key="admin-login"
                      to="/admin-login"
                      className="rounded-md border border-[#d8e5e8] px-5 py-2.5 text-sm font-semibold text-[#173957] transition hover:bg-[#f4faf6]"
                    >
                      管理员登录
                    </Link>,
                    ]
              }
            >
              {!admin ? (
                <div className="rounded-xl border border-[#f0dfb8] bg-[#fff8e8] px-4 py-3 text-sm leading-6 text-[#6d7780]">
                  默认管理员账号通常在项目初始化时创建，后续可替换为正式后台账号。
                </div>
              ) : null}
            </SessionCard>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
