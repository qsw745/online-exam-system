import { lazy, Suspense, type ReactElement } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import NotFound404 from '@/app/errors/NotFound404'
import ServerError500 from '@/app/errors/ServerError500'
import DynamicRoutes from '@/app/routing/DynamicRoutes'

const withSuspense = (el: ReactElement) => <Suspense fallback={<LoadingSpinner />}>{el}</Suspense>

// Auth
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))

export const router = createBrowserRouter([
  // 公开页
  { path: '/login', element: withSuspense(<LoginPage />) },
  { path: '/register', element: withSuspense(<RegisterPage />) },
  { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
  { path: '/reset-password', element: withSuspense(<ResetPasswordPage />) },

  // 受保护区 + 所有动态业务路由
  {
    path: '/*',
    element: <DynamicRoutes />,
    errorElement: <ServerError500 />,
  },

  // 顶层兜底
  { path: '*', element: <NotFound404 /> },
])
