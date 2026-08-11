// web/src/App.jsx
import React, { lazy, Suspense, useEffect } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Loading } from '@/common/components/loading'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AuthGuard from '@/common/auth/AuthGuard'
import HomePage from '@/pages/Home'
import { authBus } from '@/common/auth/authBus'
import { appAlert } from '@/common/components/modal/alertBridge'
import AdminLoginPage from '@/pages/AdminLogin'
import { ADMIN_PERMISSIONS } from '@/common/consts/adminPermissions'
import {
  resolveProductName,
  runtimeConfig,
} from '@/common/config/runtimeConfig.mjs'
import FeatureGate from '@/common/routing/FeatureGate'
import RouteErrorBoundary from '@/common/routing/RouteErrorBoundary'
import { importWithRetry } from '@/common/routing/lazyRoute.mjs'

import 'normalize.css/normalize.css'

// const Index = lazy(() => import('@/pages'))
const lazyRoute = (importer) => lazy(() => importWithRetry(importer))
const AdminMenuPage = lazyRoute(() => import('@/pages/AdminMenu'))
const AdminUsersPage = lazyRoute(() => import('@/pages/AdminUsers'))
const AdminRBACPage = lazyRoute(() => import('@/pages/AdminRBAC'))
const AdminGuidePage = lazyRoute(() => import('@/pages/AdminGuide'))
const WorkQueuePage = lazyRoute(() => import('@/pages/WorkQueue'))
const NotFoundPage = lazyRoute(() => import('@/pages/NotFound'))

const App = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const appTitle = resolveProductName(
    runtimeConfig,
    import.meta.env.VITE_APP_TITLE
  )

  useEffect(() => {
    return authBus.onUnauthorized(({ from, message, loginPath }) => {
      // 如果 payload 没带，就 fallback 为当前 location
      const safeFrom = from || {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      }
      const targetLoginPath = loginPath || '/login'

      appAlert({
        title: '登录状态已失效',
        message: message || '登录已过期，请重新登录',
        confirmText: '重新登录',
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
        <title>{appTitle}</title>
      </Helmet>
      <RouteErrorBoundary key={location.pathname}>
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
              path="/admin-accounts"
              element={
                <AuthGuard
                  requireAdmin
                  permission={ADMIN_PERMISSIONS.USER_READ}
                >
                  <AdminUsersPage />
                </AuthGuard>
              }
            />
            <Route
              path="/admin-rbac"
              element={
                <AuthGuard
                  requireAdmin
                  permission={ADMIN_PERMISSIONS.RBAC_READ}
                >
                  <AdminRBACPage />
                </AuthGuard>
              }
            />
            <Route
              path="/admin-guide"
              element={
                runtimeConfig.features.adminGuide ? (
                  <AuthGuard requireAdmin>
                    <AdminGuidePage />
                  </AuthGuard>
                ) : (
                  <Navigate to="/admin-menu" replace />
                )
              }
            />
            <Route
              path="/admin-users"
              element={<Navigate to="/admin-accounts" replace />}
            />
            <Route
              path="/admin-hierarchy"
              element={<Navigate to="/admin-guide" replace />}
            />
            <Route
              path="/work-queue"
              element={
                <FeatureGate feature="mobileWorkQueue" name="移动工作队列">
                  <AuthGuard>
                    <WorkQueuePage />
                  </AuthGuard>
                </FeatureGate>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </>
  )
}

export default App
