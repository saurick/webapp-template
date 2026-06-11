import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, getCurrentUser, logout } from '@/common/auth/auth'

const RECENT_ITEMS = [
  ['需求规格说明书', '今天 10:24', '已完成'],
  ['用户登录功能', '昨天 16:45', '已完成'],
  ['接口文档.pdf', '05-18 09:15', '已上传'],
]

export default function HomePage() {
  const navigate = useNavigate()
  // 前台首页只处理普通用户登录态，管理员入口固定走 /admin-login。
  const user = getCurrentUser(AUTH_SCOPE.USER)
  const username = user?.username || '访客'

  const handleLogout = () => {
    logout(AUTH_SCOPE.USER)
    navigate('/login', { replace: true })
  }

  return (
    <AppShell>
      <header className="border-b border-[#dfe7e3] bg-white/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/" className="text-lg font-semibold text-[#172b3f]">
            项目工作台
          </Link>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-[#dfe7e3] px-3 py-2 text-sm text-[#172b3f] hover:bg-[#f7faf8]"
            >
              退出
            </button>
          ) : (
            <div className="flex gap-2">
              <Link
                to="/login"
                className="rounded-md bg-[#147a42] px-4 py-2 text-sm font-medium text-white hover:bg-[#106d3a]"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="rounded-md border border-[#dfe7e3] px-4 py-2 text-sm font-medium text-[#172b3f] hover:bg-[#f7faf8]"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex min-h-[260px] flex-col justify-between rounded-lg border border-[#dfe7e3] bg-white p-7">
          <div>
            <p className="text-sm font-medium text-[#6d7780]">普通用户</p>
            <h1
              aria-label={`欢迎回来，${username}`}
              className="mt-3 max-w-[12ch] text-4xl font-semibold leading-tight text-[#172b3f]"
            >
              欢迎回来，{username}
            </h1>
          </div>
          <div className="h-1 w-16 rounded-full bg-[#147a42]" />
        </section>

        <section className="rounded-lg border border-[#dfe7e3] bg-white">
          <div className="border-b border-[#eef3f0] px-5 py-4">
            <h2 className="text-base font-semibold text-[#172b3f]">最近活动</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#eef3f0] text-[#6d7780]">
                  <th className="px-5 py-3 font-medium">事项</th>
                  <th className="px-5 py-3 font-medium">时间</th>
                  <th className="px-5 py-3 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_ITEMS.map(([name, time, status]) => (
                  <tr key={name} className="border-b border-[#f2f5f3]">
                    <td className="px-5 py-4 font-medium text-[#172b3f]">
                      {name}
                    </td>
                    <td className="px-5 py-3 text-[#6d7780]">{time}</td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-[#eef8f0] px-2 py-1 text-xs font-medium text-[#147a42]">
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
