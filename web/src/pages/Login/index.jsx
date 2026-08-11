import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'
import ThemeToggle from '@/common/theme/ThemeToggle'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const from =
    (location.state?.from?.pathname || '/') +
    (location.state?.from?.search || '') +
    (location.state?.from?.hash || '')

  const authRpc = useMemo(() => new JsonRpc({ url: 'auth' }), [])

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
      const result = await authRpc.call('login', {
        username: username.trim(),
        password,
      })

      persistAuth(result?.data, AUTH_SCOPE.USER)
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
            <Link
              to="/"
              className="app-muted text-sm hover:text-[var(--app-text)]"
            >
              返回首页
            </Link>
            <ThemeToggle compact />
          </div>
          <h1 className="mt-8 text-3xl font-semibold">用户登录</h1>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            <div>
              <label className="app-form-label mb-2 block text-sm font-medium">
                用户名
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="app-form-input w-full rounded-md border px-3.5 py-3 outline-none"
                placeholder="请输入用户名"
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
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>

          <div className="app-muted mt-6 text-sm">
            没有账号？{' '}
            <Link to="/register" className="app-link font-medium">
              注册
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
