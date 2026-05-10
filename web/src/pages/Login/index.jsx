import React, { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppShell from '@/common/components/layout/AppShell'
import SurfacePanel from '@/common/components/layout/SurfacePanel'
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
    <AppShell className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-[#6d7780] transition hover:text-[#173957]"
          >
            返回首页
          </Link>
        </div>

        <div className="mb-6 text-center sm:mb-8">
          <div className="inline-flex rounded-md border border-[#d7e5df] bg-[#f4faf6] px-3 py-1 text-xs font-medium text-[#2b8a4b]">
            用户登录
          </div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-[#173957]">
            欢迎登录
          </div>
          <div className="mt-2 text-sm leading-6 text-[#6d7780]">
            使用已有账号继续访问当前项目；如果是首次使用，请先注册普通用户账号。
          </div>
        </div>

        <SurfacePanel className="p-4 sm:p-6">
          <form onSubmit={onSubmit} className="p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#172b3f]">
                  用户名
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-[#d6dadd] bg-white px-4 py-3 text-[#172b3f] outline-none transition placeholder:text-[#a4acb3] focus:border-[#2f9348] focus:ring-2 focus:ring-[#2f9348]/15"
                  placeholder="输入用户名"
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
                  className="w-full rounded-xl border border-[#d6dadd] bg-white px-4 py-3 text-[#172b3f] outline-none transition placeholder:text-[#a4acb3] focus:border-[#2f9348] focus:ring-2 focus:ring-[#2f9348]/15"
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

              <div className="flex items-center justify-between pt-1 text-sm text-[#6d7780]">
                <div>
                  模板默认不预置普通用户。{' '}
                  <Link
                    className="font-medium text-[#2f9348] underline underline-offset-4 transition hover:text-[#267d3c]"
                    to="/register"
                  >
                    先去注册
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </SurfacePanel>
      </div>
    </AppShell>
  )
}
