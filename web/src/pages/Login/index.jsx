import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'

function persistAuth(data) {
  const token = data?.access_token
  if (!token) throw new Error('missing access_token')

  localStorage.setItem('access_token', String(token))
  if (data?.expires_at != null)
    localStorage.setItem('expires_at', String(data.expires_at))
  if (data?.token_type)
    localStorage.setItem('token_type', String(data.token_type))
  if (data?.user_id != null)
    localStorage.setItem('user_id', String(data.user_id))
  if (data?.username) localStorage.setItem('username', String(data.username))
}

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

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0 && !submitting
  }, [username, password, submitting])

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

      // 你的约定：result.data 才是 payload
      persistAuth(result?.data)
      navigate(from, { replace: true })//
    } catch (err) {
      setErrMsg(err?.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CasinoScreen className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px]">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-wide text-amber-200">
            欢迎回来
          </div>
          <div className="mt-1 text-sm text-amber-100/70">
            登录后继续你的练习 / 计划
          </div>
        </div>

        <GoldFramePanel className="p-4 sm:p-6">
          <form onSubmit={onSubmit} className="p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-amber-100/80">
                  用户名
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  placeholder="输入用户名"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-amber-100/80">
                  密码
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  placeholder="输入密码"
                />
              </div>

              {errMsg ? (
                <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errMsg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className={
                  'w-full rounded-2xl px-4 py-3 font-bold tracking-wide ' +
                  (canSubmit
                    ? 'bg-amber-400 text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500'
                    : 'cursor-not-allowed bg-amber-400/30 text-amber-100/60')
                }
              >
                {submitting ? '登录中…' : '登录'}
              </button>

              <div className="flex items-center justify-between pt-1 text-sm text-amber-100/70">
                <div>
                  还没有账号？{' '}
                  <Link
                    className="text-amber-200 underline hover:text-amber-100"
                    to="/register"
                  >
                    去注册
                  </Link>
                </div>
              </div>
            </div>
          </form>
        </GoldFramePanel>

        {/* <div className="text-center text-xs text-amber-100/50 mt-6">
          token 会保存在 localStorage（开发阶段方便调试）
        </div> */}
      </div>
    </CasinoScreen>
  )
}
