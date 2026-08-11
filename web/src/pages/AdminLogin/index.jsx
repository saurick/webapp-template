import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { runtimeConfig } from '@/common/config/runtimeConfig.mjs'
import ThemeToggle from '@/common/theme/ThemeToggle'

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
    <AppShell className="flex items-start justify-center px-5 pb-10 pt-[12vh]">
      <main className="w-full max-w-[400px]">
        <section className="app-auth-card rounded-lg border p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="app-muted text-sm font-medium">
              {runtimeConfig.branding.adminName}
            </p>
            <ThemeToggle compact />
          </div>
          <h1 className="mt-8 text-3xl font-semibold">管理员登录</h1>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            <div>
              <label className="app-form-label mb-2 block text-sm font-medium">
                管理员账号
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="app-form-input w-full rounded-md border px-3.5 py-3 outline-none"
                placeholder="请输入管理员账号"
              />
            </div>

            <div>
              <label className="app-form-label mb-2 block text-sm font-medium">
                密码
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                className="app-form-input w-full rounded-md border px-3.5 py-3 outline-none"
                placeholder="请输入密码"
              />
            </div>

            {errMsg ? (
              <div className="app-error-message rounded-md border px-3 py-2 text-sm">
                {errMsg}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!canSubmit}
              className="app-primary-button w-full rounded-md px-4 py-3 text-sm font-medium"
            >
              {submitting ? '登录中…' : '管理员登录'}
            </button>
          </form>

          <p className="app-muted mt-5 text-sm">普通用户账号不可登录后台。</p>
        </section>
      </main>
    </AppShell>
  )
}
