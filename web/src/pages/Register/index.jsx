import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'
import ThemeToggle from '@/common/theme/ThemeToggle'

export default function RegisterPage() {
  const navigate = useNavigate()
  const authRpc = useMemo(() => new JsonRpc({ url: 'auth' }), [])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const pwdHint =
    password && password.length < 6
      ? '密码至少 6 位'
      : password && password2 && password !== password2
        ? '两次密码不一致'
        : ''

  const canSubmit = useMemo(() => {
    if (submitting) return false
    if (!username.trim() || !password || !password2) return false
    if (password.length < 6) return false
    if (password !== password2) return false
    return true
  }, [username, password, password2, submitting])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setErrMsg('')
    setSubmitting(true)

    try {
      const result = await authRpc.call('register', {
        username: username.trim(),
        password,
      })

      persistAuth(result?.data, AUTH_SCOPE.USER)
      navigate('/', { replace: true })
    } catch (err) {
      setErrMsg(getActionErrorMessage(err, '注册'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell className="flex items-start justify-center px-5 pb-10 pt-[8vh]">
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
          <h1 className="mt-8 text-3xl font-semibold">用户注册</h1>

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
                autoComplete="new-password"
                className="app-form-input w-full rounded-md border px-3.5 py-3 outline-none"
                placeholder="至少 6 位"
              />
            </div>

            <div>
              <label className="app-form-label mb-2 block text-sm font-medium">
                确认密码
              </label>
              <input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="app-form-input w-full rounded-md border px-3.5 py-3 outline-none"
                placeholder="再次输入密码"
              />
              {pwdHint ? (
                <div className="app-warning-message mt-2 text-xs">
                  {pwdHint}
                </div>
              ) : null}
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
              {submitting ? '注册中…' : '注册并登录'}
            </button>
          </form>

          <div className="app-muted mt-6 text-sm">
            已有账号？{' '}
            <Link to="/login" className="app-link font-medium">
              登录
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
