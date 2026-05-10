import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import SurfacePanel from '@/common/components/layout/SurfacePanel'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const from =
    (location.state?.from?.pathname || '/admin-menu') +
    (location.state?.from?.search || '') +
    (location.state?.from?.hash || '')

  const authRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'auth',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.length > 0 && !submitting,
    [username, password, submitting]
  )

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setErrMsg('')
    setSubmitting(true)

    try {
      const result = await authRpc.call('admin_login', {
        username: username.trim(),
        password,
      })

      persistAuth(result?.data, AUTH_SCOPE.ADMIN)
      navigate(from, { replace: true })
    } catch (err) {
      setErrMsg(getActionErrorMessage(err, '登录'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell className="flex items-center justify-center px-4 py-6 sm:py-8 md:py-10">
      <div className="w-full max-w-[660px]">
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-[#6d7780] transition hover:text-[#173957]"
          >
            返回首页
          </Link>
        </div>

        <SurfacePanel className="px-6 py-7 sm:px-8 sm:py-9">
          <div className="mb-6">
            <div className="inline-flex rounded-md border border-[#f0dfb8] bg-[#fff8e8] px-3 py-1 text-xs font-medium text-[#b7791f]">
              管理登录
            </div>
            <div className="mt-5 text-[32px] font-extrabold leading-tight tracking-normal text-[#173957] sm:text-[42px]">
              管理控制台登录
            </div>
            <div className="mt-3 text-sm leading-6 text-[#6d7780]">
              用于访问账号目录和角色权限页。默认管理员可由服务端在启动时自动创建。
            </div>
          </div>

          <form onSubmit={onSubmit}>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#172b3f]">
                  管理员账号
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-[#d6dadd] bg-white px-4 py-3 text-base text-[#172b3f] outline-none transition placeholder:text-[#a4acb3] focus:border-[#2f9348] focus:ring-2 focus:ring-[#2f9348]/15"
                  placeholder="输入管理员账号"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#172b3f]">
                  密码
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[#d6dadd] bg-white px-4 py-3 text-base text-[#172b3f] outline-none transition placeholder:text-[#a4acb3] focus:border-[#2f9348] focus:ring-2 focus:ring-[#2f9348]/15"
                  placeholder="输入密码"
                />
              </div>

              {errMsg ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errMsg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold tracking-wide transition sm:text-base ${
                  canSubmit
                    ? 'bg-[#2f9348] text-white shadow-[0_10px_22px_rgba(47,147,72,0.2)] hover:bg-[#267d3c] active:bg-[#236f36]'
                    : 'cursor-not-allowed bg-[#d8e5dc] text-[#8d9a92]'
                }`}
              >
                {submitting ? '登录中…' : '登录'}
              </button>
            </div>
          </form>
        </SurfacePanel>
      </div>
    </AppShell>
  )
}
