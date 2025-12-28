// web/src/App.jsx
import React, { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loading } from '@/common/components/loading'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AuthGuard from '@/common/auth/AuthGuard'
import { BlankPage } from '@/pages/blankPage'
import InviteCodesPage from '@/pages/InviteCodes'
import { authBus } from '@/common/auth/authBus'
import { casinoAlert } from '@/common/components/modal/alertBridge'

import 'normalize.css/normalize.css'

// const Index = lazy(() => import('@/pages'))

const App = () => {
  const navigate = useNavigate()

  useEffect(() => {
    return authBus.onUnauthorized(({ from, message }) => {
        // 如果 payload 没带，就 fallback 为当前 location
        const safeFrom = from || {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        }

      casinoAlert({
        title: '提示',
        message: message || '登录已过期，请重新登录',
        confirmText: '去登录',
        onConfirm: () => {
          navigate('/login', { replace: true, state: { from: safeFrom } })
        },
      })
    })
  }, [navigate])

  return (
    <React.Fragment>
      <Helmet>
        <title>React App</title>
      </Helmet>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* <Route path="*" element={<Index />} />  // 匹配所有路径，显示Index组件 */}
          {/* <Route path="/about" element={<About />} />  // 匹配/about路径，显示About组件 */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invite-codes" element={<AuthGuard requireAdmin><InviteCodesPage /></AuthGuard>} />
          <Route path="/" element={<BlankPage />} />
        </Routes>
      </Suspense>
    </React.Fragment>
  )
}

export default App
