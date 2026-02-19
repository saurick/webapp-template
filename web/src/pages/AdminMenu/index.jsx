import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import CasinoScreen from '@/common/components/layout/CasinoScreen'
import GoldFramePanel from '@/common/components/layout/GoldFramePanel'
import { JsonRpc } from '@/common/utils/jsonRpc'
import { ADMIN_BASE_PATH } from '@/common/utils/adminRpc'
import { AUTH_SCOPE, logout } from '@/common/auth/auth'

export default function AdminMenuPage() {
  const navigate = useNavigate()
  const authRpc = useMemo(
    () =>
      new JsonRpc({
        url: 'auth',
        basePath: ADMIN_BASE_PATH,
        authScope: AUTH_SCOPE.ADMIN,
      }),
    []
  )

  const handleLogout = async () => {
    if (!window.confirm('确认退出管理员登录吗？')) return
    try {
      await authRpc.call('logout')
    } catch (e) {
      console.warn('服务器 logout 失败', e)
    } finally {
      logout(AUTH_SCOPE.ADMIN)
      navigate('/admin-login', { replace: true })
    }
  }

  return (
    <CasinoScreen className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px]">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold tracking-wide text-amber-200">
            管理菜单
          </div>
          <div className="mt-1 text-sm text-amber-100/70">模板公共后台入口</div>
        </div>

        <GoldFramePanel className="p-4 sm:p-6">
          <div className="space-y-3 p-4 sm:p-6">
            <button
              type="button"
              onClick={() => navigate('/admin-users')}
              className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500"
            >
              用户管理
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin-hierarchy')}
              className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500"
            >
              分级管理
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-bold text-[#1b1b1b] hover:bg-amber-300 active:bg-amber-500"
            >
              退出登录
            </button>
          </div>
        </GoldFramePanel>
      </div>
    </CasinoScreen>
  )
}
