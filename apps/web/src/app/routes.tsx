// src/app/routes.tsx
import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import Layout from '@shared/components/Layout'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import NotFound404 from '@app/errors/NotFound404'
import Forbidden403 from '@app/errors/Forbidden403'
import ServerError500 from '@app/errors/ServerError500'

const withSuspense = (el: JSX.Element) => <Suspense fallback={<LoadingSpinner />}>{el}</Suspense>

/** 顶层 */
const DashboardPage = lazy(() => import('@features/dashboard/pages/DashboardPage'))
const AnalyticsPage = lazy(() => import('@features/analytics/pages/AnalyticsPage'))
const DiscussionPage = lazy(() => import('@features/discussions/pages/DiscussionPage'))
const ExamListPage = lazy(() => import('@features/exams/pages/ExamListPage'))
const ExamPage = lazy(() => import('@features/exams/pages/ExamPage'))
const ResultsPage = lazy(() => import('@features/exams/pages/ResultsPage'))
const QuestionsPage = lazy(() => import('@features/questions/pages/QuestionsPage'))
const QuestionPracticePage = lazy(() => import('@features/questions/pages/QuestionPracticePage'))
const FavoritesPage = lazy(() => import('@features/favorites/pages/FavoritesPage'))
const LeaderboardPage = lazy(() => import('@features/leaderboard/pages/LeaderboardPage'))
const LearningProgressPage = lazy(() => import('@features/learning-progress/pages/LearningProgressPage'))
const LogsPage = lazy(() => import('@features/logs/pages/LogsPage'))
const NotificationsPage = lazy(() => import('@features/notifications/pages/NotificationsPage'))
const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const SettingsPage = lazy(() => import('@features/settings/pages/SettingsPage'))
const WrongQuestionsPage = lazy(() => import('@features/wrong-questions/pages/WrongQuestionsPage'))
const TasksPage = lazy(() => import('@features/tasks/pages/TasksPage'))
const MyTasksPage = lazy(() => import('@features/tasks/pages/MyTasksPage'))
const PublishTaskPage = lazy(() => import('@features/tasks/pages/PublishTaskPage'))
const TaskDetailPage = lazy(() => import('@features/tasks/pages/TaskDetailPage'))

/** Auth */
const LoginPage = lazy(() => import('@features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@features/auth/pages/ResetPasswordPage'))

/** Admin 聚合与各子页 */
const AdminPage = lazy(() => import('@features/admin/pages/AdminPage'))
const OrgManage = lazy(() => import('@features/orgs/pages/OrgManage'))
const RoleManagementPage = lazy(() => import('@features/roles/pages/RoleManagementPage'))
const MenuManagementPage = lazy(() => import('@features/menu/pages/MenuManagementPage'))
const UserManagementPage = lazy(() => import('@features/users/pages/UserManagementPage'))
const UserRoleManagementPage = lazy(() => import('@features/users/pages/UserRoleManagementPage'))
const TaskManagementPage = lazy(() => import('@features/tasks/pages/TaskManagementPage'))
const TaskCreatePage = lazy(() => import('@features/tasks/pages/TaskCreatePage'))
const PaperManagementPage = lazy(() => import('@features/papers/pages/PaperManagementPage'))
const PaperCreatePage = lazy(() => import('@features/papers/pages/PaperCreatePage'))
const ManualPaperCreationPage = lazy(() => import('@features/papers/pages/ManualPaperCreationPage'))
const SmartPaperCreatePage = lazy(() => import('@features/papers/pages/SmartPaperCreatePage'))
const QuestionManagementPage = lazy(() => import('@features/questions/pages/QuestionManagementPage'))
const QuestionCreatePage = lazy(() => import('@features/questions/pages/QuestionCreatePage'))
const DataAnalyticsPage = lazy(() => import('@features/analytics/pages/DataAnalyticsPage'))
const GradeManagementPage = lazy(() => import('@features/analytics/pages/GradeManagementPage'))
const AdminSettingsPage = lazy(() => import('@features/settings/pages/AdminSettingsPage'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ServerError500 />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },

      // 顶层业务页
      { path: 'analytics', element: withSuspense(<AnalyticsPage />) },
      { path: 'discussion', element: withSuspense(<DiscussionPage />) },
      { path: 'exams', element: withSuspense(<ExamListPage />) },
      { path: 'exams/:id', element: withSuspense(<ExamPage />) },
      { path: 'results', element: withSuspense(<ResultsPage />) },
      { path: 'questions', element: withSuspense(<QuestionsPage />) },
      { path: 'questions/practice', element: withSuspense(<QuestionPracticePage />) },
      { path: 'favorites', element: withSuspense(<FavoritesPage />) },
      { path: 'leaderboard', element: withSuspense(<LeaderboardPage />) },
      { path: 'learning-progress', element: withSuspense(<LearningProgressPage />) },
      { path: 'logs', element: withSuspense(<LogsPage />) },
      { path: 'notifications', element: withSuspense(<NotificationsPage />) },
      { path: 'profile', element: withSuspense(<ProfilePage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: 'wrong-questions', element: withSuspense(<WrongQuestionsPage />) },

      // 任务（用户端）
      { path: 'tasks', element: withSuspense(<TasksPage />) },
      { path: 'tasks/my', element: withSuspense(<MyTasksPage />) },
      { path: 'tasks/publish', element: withSuspense(<PublishTaskPage />) },
      { path: 'tasks/:taskId', element: withSuspense(<TaskDetailPage />) },

      // Admin 区域
      {
        path: 'admin',
        element: withSuspense(<AdminPage />),
        children: [
          { path: 'orgs', element: withSuspense(<OrgManage />) },
          { path: 'roles', element: withSuspense(<RoleManagementPage />) },
          { path: 'menus', element: withSuspense(<MenuManagementPage />) },
          { path: 'users', element: withSuspense(<UserManagementPage />) },
          { path: 'users/roles', element: withSuspense(<UserRoleManagementPage />) },
          { path: 'tasks', element: withSuspense(<TaskManagementPage />) },
          { path: 'tasks/create', element: withSuspense(<TaskCreatePage />) },
          { path: 'papers', element: withSuspense(<PaperManagementPage />) },
          { path: 'papers/create', element: withSuspense(<PaperCreatePage />) },
          { path: 'papers/create/manual', element: withSuspense(<ManualPaperCreationPage />) },
          { path: 'papers/create/smart', element: withSuspense(<SmartPaperCreatePage />) },
          { path: 'questions', element: withSuspense(<QuestionManagementPage />) },
          { path: 'questions/create', element: withSuspense(<QuestionCreatePage />) },
          { path: 'analytics', element: withSuspense(<DataAnalyticsPage />) },
          { path: 'analytics/grades', element: withSuspense(<GradeManagementPage />) },
          { path: 'settings', element: withSuspense(<AdminSettingsPage />) },
          { path: '403', element: <Forbidden403 /> },
        ],
      },
    ],
  },

  // Auth
  { path: '/login', element: withSuspense(<LoginPage />) },
  { path: '/register', element: withSuspense(<RegisterPage />) },
  { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
  { path: '/reset-password', element: withSuspense(<ResetPasswordPage />) },

  // 404
  { path: '*', element: <NotFound404 /> },
])
