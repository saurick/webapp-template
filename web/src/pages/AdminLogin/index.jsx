import React, { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { AUTH_SCOPE, persistAuth } from '@/common/auth/auth'

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

  const canSubmit = useMemo(() => {
    return username.trim().length > 0 && password.length > 0 && !submitting
  }, [username, password, submitting])

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
      setErrMsg(err?.message || String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CasinoScreen className="flex items-center justify-center px-4 py-6 sm:py-8 md:py-10">
      <div className="w-full max-w-[520px]">
        <div className="mb-4 text-center sm:mb-6">
          <div className="text-xl font-extrabold tracking-wide text-amber-200 sm:text-2xl">
            紅藍遊戲管理後台
          </div>
        </div>

        <GoldFramePanel className="p-3 sm:p-4 md:p-6">
          <form onSubmit={onSubmit} className="p-3 sm:p-4 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                  管理員帳號
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-base text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-4 sm:py-3 sm:text-base"
                  placeholder="輸入管理員帳號"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-amber-100/80 sm:text-sm">
                  密碼
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-amber-200/30 bg-black/25 px-3 py-2 text-base text-amber-100 outline-none focus:border-amber-200/60 focus:ring-2 focus:ring-amber-200/20 sm:px-4 sm:py-3 sm:text-base"
                  placeholder="輸入密碼"
                />
              </div>

              {errMsg ? (
                <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-100 sm:px-4 sm:py-3 sm:text-sm">
                  {errMsg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full rounded-2xl px-4 py-2.5 text-sm font-bold tracking-wide sm:py-3 sm:text-base ${
                  canSubmit
                    ? 'bg-amber-400 text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500'
                    : 'cursor-not-allowed bg-amber-400/30 text-amber-100/60'
                }`}
              >
                {submitting ? '登錄中…' : '登錄'}
              </button>
            </div>
          </form>
        </GoldFramePanel>
      </div>
    </CasinoScreen>
  )
}
