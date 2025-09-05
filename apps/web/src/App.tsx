/// <reference types="react" />
/// <reference types="react-dom" />

import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 通用层（shared）
import Layout from '@shared/components/Layout'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { AuthProvider, useAuth } from '@shared/contexts/AuthContext'
import { LanguageProvider } from '@shared/contexts/LanguageContext'
import { MenuPermissionProvider } from '@shared/contexts/MenuPermissionContext'

// 全局 Provider（主题、样式 等）
import { AppProviders } from './AppProviders'

// 错误页 & 动态菜单
import NotFound404 from '@app/errors/NotFound404'
import DynamicRoutes from '@app/routing/DynamicRoutes'

// 顶层业务页面（features）
import AdminPage from '@features/admin/pages/AdminPage'
import OrgManage from '@features/orgs/pages/OrgManage'
import AnalyticsPage from '@features/analytics/pages/AnalyticsPage'
import ForgotPasswordPage from '@features/auth/pages/ForgotPasswordPage'
import LoginPage from '@features/auth/pages/LoginPage'
import RegisterPage from '@features/auth/pages/RegisterPage'
import ResetPasswordPage from '@features/auth/pages/ResetPasswordPage'
import DashboardPage from '@features/dashboard/pages/DashboardPage'
import DiscussionPage from '@features/discussions/pages/DiscussionPage'
import ExamListPage from '@features/exams/pages/ExamListPage'
import ExamPage from '@features/exams/pages/ExamPage'
import FavoritesPage from '@features/favorites/pages/FavoritesPage'
import LeaderboardPage from '@features/leaderboard/pages/LeaderboardPage'
import LearningProgressPage from '@features/learning-progress/pages/LearningProgressPage'
import LogsPage from '@features/logs/pages/LogsPage'
import NotificationsPage from '@features/notifications/pages/NotificationsPage'
import ProfilePage from '@features/profile/pages/ProfilePage'
import QuestionPracticePage from '@features/questions/pages/QuestionPracticePage'
import QuestionsPage from '@features/questions/pages/QuestionsPage'
import ResultsPage from '@features/exams/pages/ResultsPage'
import SettingsPage from '@features/settings/pages/SettingsPage'
import TasksPage from '@features/tasks/pages/TasksPage'
import WrongQuestionsPage from '@features/wrong-questions/pages/WrongQuestionsPage'

// —— Query Client 全局设置 —— //
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

// —— 访问控制：与你现有逻辑一致 —— //
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    )
  }
  const hasUser = user !== null
  const hasToken = localStorage.getItem('token') !== null
  if (!hasUser && !hasToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    )
  }
  const hasUser = user !== null
  const hasToken = localStorage.getItem('token') !== null
  if (hasUser || hasToken) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <LoadingSpinner />
      </div>
    )
  }
  const userRole = user?.role || localStorage.getItem('userRole')
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher'
  if (!isAdminOrTeacher) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function MenuPermissionRoute({ children }: { children: ReactNode; requiredPath?: string }) {
  // 预留给菜单权限校验
  return <>{children}</>
}

// —— 路由（保留你的动态菜单注入方式） —— //
function AppRoutes() {
  const dynamicRouteElements = DynamicRoutes()
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

        {/* 动态菜单注入 */}
        {dynamicRouteElements}

        {/* 兜底 404（放在最后） */}
        <Route path="*" element={<NotFound404 />} />
      </Route>

      {/* 独立布局页面 */}
      <Route
        path="/exam/:taskId"
        element={
          <ProtectedRoute>
            <ExamPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

// —— App 根组件（集中 Provider） —— //
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MenuPermissionProvider>
          <LanguageProvider>
            <AppProviders>
              <Router>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
                  <AppRoutes />
                </div>
              </Router>
            </AppProviders>
          </LanguageProvider>
        </MenuPermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
