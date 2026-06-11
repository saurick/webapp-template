import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'

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
        <section className="rounded-lg border border-[#dfe7e3] bg-white p-8">
          <Link to="/" className="text-sm text-[#6d7780] hover:text-[#172b3f]">
            返回首页
          </Link>
          <h1 className="mt-8 text-3xl font-semibold text-[#172b3f]">
            用户登录
          </h1>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#172b3f]">
                用户名
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-[#ccd8d2] px-3.5 py-3 text-[#172b3f] outline-none focus:border-[#147a42]"
                placeholder="请输入用户名"
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
                className="w-full rounded-md border border-[#ccd8d2] px-3.5 py-3 text-[#172b3f] outline-none focus:border-[#147a42]"
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
              className={`w-full rounded-md px-4 py-3 text-sm font-medium ${
                canSubmit
                  ? 'bg-[#147a42] text-white hover:bg-[#106d3a]'
                  : 'cursor-not-allowed bg-[#dfe7e3] text-[#7d8b84]'
              }`}
            >
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-sm text-[#6d7780]">
            没有账号？{' '}
            <Link to="/register" className="font-medium text-[#147a42]">
              注册
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
