import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'
import { getActionErrorMessage } from '@/common/utils/errorMessage'
import { JsonRpc } from '@/common/utils/jsonRpc'

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
        <section className="rounded-lg border border-[#dfe7e3] bg-white p-8">
          <Link to="/" className="text-sm text-[#6d7780] hover:text-[#172b3f]">
            返回首页
          </Link>
          <h1 className="mt-8 text-3xl font-semibold text-[#172b3f]">
            用户注册
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
                autoComplete="new-password"
                className="w-full rounded-md border border-[#ccd8d2] px-3.5 py-3 text-[#172b3f] outline-none focus:border-[#147a42]"
                placeholder="至少 6 位"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#172b3f]">
                确认密码
              </label>
              <input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-[#ccd8d2] px-3.5 py-3 text-[#172b3f] outline-none focus:border-[#147a42]"
                placeholder="再次输入密码"
              />
              {pwdHint ? (
                <div className="mt-2 text-xs text-[#b7791f]">{pwdHint}</div>
              ) : null}
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
              {submitting ? '注册中…' : '注册并登录'}
            </button>
          </form>

          <div className="mt-6 text-sm text-[#6d7780]">
            已有账号？{' '}
            <Link to="/login" className="font-medium text-[#147a42]">
              登录
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
