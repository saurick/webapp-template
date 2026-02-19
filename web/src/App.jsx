// web/src/App.jsx
import React, { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loading } from '@/common/components/loading'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AuthGuard from '@/common/auth/AuthGuard'
import { BlankPage } from '@/pages/blankPage'
import { authBus } from '@/common/auth/authBus'
import { casinoAlert } from '@/common/components/modal/alertBridge'
import AdminUsersPage from '@/pages/AdminUsers'
import AdminLoginPage from '@/pages/AdminLogin'
import AdminMenuPage from '@/pages/AdminMenu'
import AdminHierarchyPage from '@/pages/AdminHierarchy'

import 'normalize.css/normalize.css'

// const Index = lazy(() => import('@/pages'))

const App = () => {
  const navigate = useNavigate()

  useEffect(() => {
    return authBus.onUnauthorized(({ from, message, loginPath }) => {
      // 如果 payload 没带，就 fallback 为当前 location
      const safeFrom = from || {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }
      const targetLoginPath = loginPath || '/login'

      casinoAlert({
        title: '提示',
        message: message || '登录已过期，请重新登录',
        confirmText: '去登录',
        onConfirm: () => {
          navigate(targetLoginPath, {
            replace: true,
            state: { from: safeFrom },
          })
        },
      })
    })
  }, [navigate])

  return (
    <>
      <Helmet>
        <title>React App</title>
      </Helmet>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* <Route path="*" element={<Index />} />  // 匹配所有路径，显示Index组件 */}
          {/* <Route path="/about" element={<About />} />  // 匹配/about路径，显示About组件 */}
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin-menu"
            element={
              <AuthGuard requireAdmin>
                <AdminMenuPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin-users"
            element={
              <AuthGuard requireAdmin>
                <AdminUsersPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin-hierarchy"
            element={
              <AuthGuard requireAdmin>
                <AdminHierarchyPage />
              </AuthGuard>
            }
          />
          <Route path="/" element={<BlankPage />} />
        </Routes>
      </Suspense>
    </>
  )
}

export default App
