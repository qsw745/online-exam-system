// src/app/routes.tsx
import NotFound404 from '@/app/errors/NotFound404'
import ServerError500 from '@/app/errors/ServerError500'
import DynamicRoutes from '@/app/routing/DynamicRoutes'
import RouterRoot from '@/app/routing/RouterRoot' // 确保路径指向 src/app/routing/RouterRoot.tsx
import SettingsPage from '@/features/settings/pages/SettingsPage'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { appBasePath } from '@/shared/router/basePath'
import NProgress from 'nprogress'
import { lazy, Suspense, type ReactElement } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { translate } from '@/shared/utils/i18n'

NProgress.configure({ showSpinner: false, trickleSpeed: 120 }) // 可调
const withSuspense = (el: ReactElement) => (
  <Suspense fallback={<LoadingSpinner center="page" text={translate('visible.3e048bc8b8')} />}>{el}</Suspense>
)

// ===== Auth =====
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const OAuthCallbackPage = lazy(() => import('@/features/auth/pages/OAuthCallbackPage'))
const MobileFaceAuthPage = lazy(() => import('@/features/auth/pages/MobileFaceAuthPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'))
const SharedFavoritePage = lazy(() => import('@/features/favorites/pages/SharedFavoritePage'))

/**
 * 关键点：
 * 1) 顶层增加 index 路由：访问 "/" 时立即跳到 "/dashboard"（未登录会被守卫重定向到 /login）
 * 2) 用 path="*" 挂载 <DynamicRoutes/>，因为它内部使用了 useRoutes() —— 所在路由必须以 * 结尾
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RouterRoot />,
    errorElement: <ServerError500 />,
    children: [
      // ✅ "/" 命中这里，先跳到默认页（不依赖菜单加载即可避免空白）
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // Auth pages（静态路径优先级高于 "*"）
      { path: 'login', element: withSuspense(<LoginPage />) },
      { path: 'oauth/callback', element: withSuspense(<OAuthCallbackPage />) },
      { path: 'm/face-auth', element: withSuspense(<MobileFaceAuthPage />) },
      { path: 'register', element: withSuspense(<RegisterPage />) },
      { path: 'forgot-password', element: withSuspense(<ForgotPasswordPage />) },
      { path: 'reset-password', element: withSuspense(<ResetPasswordPage />) },
      { path: 'verify-email', element: withSuspense(<VerifyEmailPage />) },
      { path: 'shared/favorites/:code', element: withSuspense(<SharedFavoritePage />) },
      // ✅ 放在 "*" 之前
      {
        path: 'settings',
        element: <SettingsPage />, // ✅ 仅一个
      },

      // ✅ 动态业务路由（/ 之下所有路径）
      { path: '*', element: <DynamicRoutes /> },

      // 独立 404（可选）
      { path: '404', element: <NotFound404 /> },
    ],
  },
], { basename: appBasePath })
