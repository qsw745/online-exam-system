import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React, { Suspense } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import LoadingSpinner from './components/LoadingSpinner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { MenuPermissionProvider } from './contexts/MenuPermissionContext'
import { useTheme } from './providers/AntdThemeProvider'

import AdminPage from './pages/admin/AdminPage'
import OrgManage from './pages/admin/OrgManage'
import AnalyticsPage from './pages/AnalyticsPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import DiscussionPage from './pages/DiscussionPage'
import NotFound404 from './pages/errors/NotFound404'
import ExamListPage from './pages/ExamListPage'
import ExamPage from './pages/ExamPage'
import FavoritesPage from './pages/FavoritesPage'
import LeaderboardPage from './pages/LeaderboardPage'
import LearningProgressPage from './pages/LearningProgressPage'
import LogsPage from './pages/LogsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import QuestionPracticePage from './pages/QuestionPracticePage'
import QuestionsPage from './pages/QuestionsPage'
import ResultsPage from './pages/ResultsPage'
import SettingsPage from './pages/SettingsPage'
import TasksPage from './pages/TasksPage'
import WrongQuestionsPage from './pages/WrongQuestionsPage'
import { useDynamicMenuRoutes } from './routes/dynamicRoutes'
import { antdTheme, darkAntdTheme } from './theme/antd-theme'

import { ErrorBoundary } from './components/ErrorBoundary'

// 创建 Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      staleTime: 300000, // 5分钟缓存
      gcTime: 600000, // 10分钟垃圾回收
      networkMode: 'offlineFirst', // 离线优先模式
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <LoadingSpinner />
            <h2 className="mt-4 text-lg font-semibold text-gray-900">正在加载系统...</h2>
            <p className="mt-2 text-sm text-gray-600">请稍候，正在验证您的身份</p>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">提示：如果加载时间过长，请尝试刷新页面</p>
            </div>

            {/* {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 mb-2">{error}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                  >
                    刷新页面
                  </button>
                  <button
                    onClick={() => {
                      localStorage.clear()
                      sessionStorage.clear()
                      window.location.href = '/login'
                    }}
                    className="w-full px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                  >
                    重新登录
                  </button>
                </div>
              </div>
            )} */}
          </div>
        </div>
      </div>
    )
  }

  // 检查用户对象和localStorage中的token
  const hasUser = user !== null
  const hasToken = localStorage.getItem('token') !== null

  if (!hasUser && !hasToken) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// 公开路由组件（只对未登录用户开放）
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    )
  }

  // 检查用户对象和localStorage中的token
  const hasUser = user !== null
  const hasToken = localStorage.getItem('token') !== null

  if (hasUser || hasToken) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// 管理员路由组件
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    )
  }

  // 检查用户对象和localStorage中的角色信息
  const userRole = user?.role || localStorage.getItem('userRole')
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher'

  if (!isAdminOrTeacher) {
    console.log('非管理员或教师角色，重定向到仪表盘')
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// 菜单权限路由组件
function MenuPermissionRoute({ children, requiredPath }: { children: React.ReactNode; requiredPath?: string }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    )
  }

  // 如果没有指定路径要求，直接返回子组件
  if (!requiredPath) {
    return <>{children}</>
  }

  // TODO: 这里可以集成菜单权限检查逻辑
  // 暂时先返回子组件，后续可以通过useMenuPermissions hook来检查权限

  return <>{children}</>
}

// 路由配置
function AppRoutes() {
  const dynamicRouteElements = useDynamicMenuRoutes() // ✅ 拿到一组 <Route/>

  return (
    <Routes>
      {/* 公开路由 */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPasswordPage />
          </PublicRoute>
        }
      />

      {/* 受保护 + 布局 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* 你现有的静态子路由 */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="questions/all" element={<QuestionsPage />} />
        <Route path="questions/browse" element={<QuestionsPage />} />
        <Route path="questions/manage" element={<QuestionsPage />} />
        <Route path="questions/favorites" element={<QuestionsPage />} />
        <Route path="questions/wrong" element={<WrongQuestionsPage />} />
        <Route path="questions/practice" element={<QuestionPracticePage />} />
        <Route path="questions/:id/practice" element={<QuestionPracticePage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="learning-progress" element={<LearningProgressPage />} />
        <Route path="learning/progress" element={<LearningProgressPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="discussion" element={<DiscussionPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="wrong-questions" element={<WrongQuestionsPage />} />
        <Route
          path="exam/list"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <ExamListPage />
            </Suspense>
          }
        />
        <Route path="orgs" element={<OrgManage />} />

        {/* 管理员静态入口 */}
        <Route
          path="admin/*"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="system/menus"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />

        {/* ✅ 动态菜单路由：放在这里，作为同层的 Route 列表注入 */}
        {dynamicRouteElements}

        {/* ⛳️ 最后再兜底 404（一定要在 DynamicRoutes 之后） */}
        <Route path="*" element={<NotFound404 />} />
      </Route>

      {/* 独立布局的页面 */}
      <Route
        path="/exam/:taskId"
        element={
          <ProtectedRoute>
            <ExamPage />
          </ProtectedRoute>
        }
      />

      {/* 顶层不再放任何 "*" 了，避免盖住子树 */}
    </Routes>
  )
}

// 主应用组件
function App() {
  const { mode } = useTheme()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MenuPermissionProvider>
          <LanguageProvider>
            <ConfigProvider locale={zhCN} theme={mode === 'dark' ? darkAntdTheme : antdTheme} componentSize="middle">
              <AntdApp>
                <Router>
                  <ErrorBoundary>
                    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
                      <AppRoutes />
                    </div>
                  </ErrorBoundary>
                </Router>
              </AntdApp>
            </ConfigProvider>
          </LanguageProvider>
        </MenuPermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
