// apps/web/src/App.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'

// 通用层（shared）
import Layout from '@shared/components/Layout'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { AuthProvider, useAuth } from '@shared/contexts/AuthContext'
import { LanguageProvider } from '@shared/contexts/LanguageContext'
import { MenuPermissionProvider } from '@shared/contexts/MenuPermissionContext'

// 全局 Provider
import { AppProviders } from './AppProviders'

// 错误页 & 动态菜单
import Forbidden403 from '@app/errors/Forbidden403'
import NotFound404 from '@app/errors/NotFound404'
import ServerError500 from '@app/errors/ServerError500'
import DynamicRoutes from '@app/routing/DynamicRoutes'

// 顶层业务页面（features）
import AnalyticsPage from '@features/analytics/pages/AnalyticsPage'
import ForgotPasswordPage from '@features/auth/pages/ForgotPasswordPage'
import LoginPage from '@features/auth/pages/LoginPage'
import RegisterPage from '@features/auth/pages/RegisterPage'
import ResetPasswordPage from '@features/auth/pages/ResetPasswordPage'
import DashboardPage from '@features/dashboard/pages/DashboardPage'
import DiscussionPage from '@features/discussions/pages/DiscussionPage'
import ExamListPage from '@features/exams/pages/ExamListPage'
import ExamPage from '@features/exams/pages/ExamPage'
import ResultsPage from '@features/exams/pages/ResultsPage'
import FavoritesPage from '@features/favorites/pages/FavoritesPage'
import LeaderboardPage from '@features/leaderboard/pages/LeaderboardPage'
import LearningProgressPage from '@features/learning-progress/pages/LearningProgressPage'
import LogsPage from '@features/logs/pages/LogsPage'
import NotificationsPage from '@features/notifications/pages/NotificationsPage'
import OrgManage from '@features/orgs/pages/OrgManage'
import ProfilePage from '@features/profile/pages/ProfilePage'
import QuestionPracticePage from '@features/questions/pages/QuestionPracticePage'
import QuestionsPage from '@features/questions/pages/QuestionsPage'
import SettingsPage from '@features/settings/pages/SettingsPage'
import TasksPage from '@features/tasks/pages/TasksPage'
import WrongQuestionsPage from '@features/wrong-questions/pages/WrongQuestionsPage'
// ✅ 新增导入
import RoleManagementPage from '@features/roles/pages/RoleManagementPage'
import MyTasksPage from '@features/tasks/pages/MyTasksPage'
import PublishTaskPage from '@features/tasks/pages/PublishTaskPage'
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

// —— 访问控制 —— //
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  const hasUser = user !== null
  const hasToken = localStorage.getItem('token') !== null
  if (!hasUser && !hasToken) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  const hasUser = user !== null
  const hasToken = localStorage.getItem('token') !== null
  if (hasUser || hasToken) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  const userRole = user?.role || localStorage.getItem('userRole')
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher'
  if (!isAdminOrTeacher) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// —— 路由 —— //
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
        <Route path="tasks/my" element={<MyTasksPage />} />
        <Route path="tasks/publish" element={<PublishTaskPage />} />
        {/* 题库 */}
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="questions/all" element={<QuestionsPage />} />
        <Route path="questions/wrong" element={<WrongQuestionsPage />} />
        {/* 练习页（显式两条） */}
        <Route path="questions/practice" element={<QuestionPracticePage />} />
        <Route path="questions/:id/practice" element={<QuestionPracticePage />} />

        {/* 其它业务页 */}
        <Route path="results" element={<ResultsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="learning-progress" element={<LearningProgressPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="discussion" element={<DiscussionPage />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="orgs" element={<OrgManage />} />
        <Route path="admin/roles" element={<RoleManagementPage />} />
        {/* 列表页（懒加载有占位） */}
        <Route
          path="exam/list"
          element={
            <Suspense fallback={<LoadingSpinner />}>
              <ExamListPage />
            </Suspense>
          }
        />

        {/* ✅ 显式错误页路由 —— 放在 dynamicRouteElements 之前 */}
        {/* 形态一：/errors/xxx */}
        <Route path="errors/403" element={<Forbidden403 />} />
        <Route path="errors/404" element={<NotFound404 />} />
        <Route path="errors/500" element={<ServerError500 />} />
        {/* 形态二：/errors-xxx（兼容你的菜单可能用这种写法） */}
        <Route path="errors-403" element={<Forbidden403 />} />
        <Route path="errors-404" element={<NotFound404 />} />
        <Route path="errors-500" element={<ServerError500 />} />

        {/* 动态菜单（最后注入，避免抢先匹配） */}
        {dynamicRouteElements}

        {/* 兜底 404（最后） */}
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

// —— App 根组件 —— //
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MenuPermissionProvider>
          <LanguageProvider>
            <AppProviders>
              <Router>
                <AppRoutes />
              </Router>
            </AppProviders>
          </LanguageProvider>
        </MenuPermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
