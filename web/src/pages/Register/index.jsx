import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'

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
      setErrMsg(err?.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CasinoScreen className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px]">
        <div className="text-center mb-6">
          <div className="text-2xl font-extrabold tracking-wide text-amber-200">创建账号</div>
        </div>

        <GoldFramePanel className="p-4 sm:p-6">
          <form onSubmit={onSubmit} className="p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-amber-100/80 mb-1">用户名</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl bg-black/25 border border-amber-200/30 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  placeholder="输入用户名"
                />
              </div>

              <div>
                <label className="block text-sm text-amber-100/80 mb-1">密码</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl bg-black/25 border border-amber-200/30 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  placeholder="至少 6 位"
                />
              </div>

              <div>
                <label className="block text-sm text-amber-100/80 mb-1">确认密码</label>
                <input
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-xl bg-black/25 border border-amber-200/30 px-4 py-3 text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20"
                  placeholder="再输入一次"
                />
                {pwdHint ? <div className="text-xs text-amber-200/90 mt-1">{pwdHint}</div> : null}
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
                    : 'bg-amber-400/30 text-amber-100/60 cursor-not-allowed')
                }
              >
                {submitting ? '注册中…' : '注册并登录'}
              </button>

              <div className="text-sm text-amber-100/70 pt-1">
                已有账号？{' '}
                <Link className="text-amber-200 hover:text-amber-100 underline" to="/login">
                  去登录
                </Link>
              </div>
            </div>
          </form>
        </GoldFramePanel>
      </div>
    </CasinoScreen>
  )
}
