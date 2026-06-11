import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
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
    <AppShell className="flex items-center justify-center px-5 py-10">
      <main className="w-full max-w-sm">
        <section className="rounded-md border border-[#dfe7e3] bg-white p-6">
          <p className="text-sm text-[#6d7780]">Admin Preset</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#172b3f]">
            管理员登录
          </h1>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#172b3f]">
                管理员账号
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-[#ccd8d2] px-3 py-2.5 text-[#172b3f] outline-none focus:border-[#147a42]"
                placeholder="请输入管理员账号"
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
                className="w-full rounded-md border border-[#ccd8d2] px-3 py-2.5 text-[#172b3f] outline-none focus:border-[#147a42]"
                placeholder="请输入密码"
              />
            </div>

            {errMsg ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errMsg}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full rounded-md px-4 py-2.5 text-sm font-medium ${
                canSubmit
                  ? 'bg-[#147a42] text-white hover:bg-[#106d3a]'
                  : 'cursor-not-allowed bg-[#dfe7e3] text-[#7d8b84]'
              }`}
            >
              {submitting ? '登录中…' : '管理员登录'}
            </button>
          </form>

          <p className="mt-5 text-sm text-[#6d7780]">
            普通用户账号不可登录后台。
          </p>
        </section>
      </main>
    </AppShell>
  )
}
