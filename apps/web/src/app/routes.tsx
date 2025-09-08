// src/app/routes.tsx
import Forbidden403 from '@app/errors/Forbidden403'
import NotFound404 from '@app/errors/NotFound404'
import ServerError500 from '@app/errors/ServerError500'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { lazy, Suspense, type ReactElement } from 'react'
import { createBrowserRouter, Navigate, redirect } from 'react-router-dom'

// 布局守卫
import AdminLayout from '@app/routing/AdminLayout'
import ProtectedLayout from '@app/routing/ProtectedLayout'

// ❗ 避免 “找不到命名空间 JSX” —— 不再使用 JSX.Element，改为 ReactElement
const withSuspense = (el: ReactElement) => <Suspense fallback={<LoadingSpinner />}>{el}</Suspense>

// ====== 顶层业务页面 ======
const DashboardPage = lazy(() => import('@features/dashboard/pages/DashboardPage'))
const AnalyticsPage = lazy(() => import('@features/analytics/pages/AnalyticsOverviewPage'))
const DiscussionPage = lazy(() => import('@features/discussions/pages/DiscussionPage'))
const ExamListPage = lazy(() => import('@features/exams/pages/ExamListPage'))
const ExamPage = lazy(() => import('@features/exams/pages/ExamPage'))
const ResultsPage = lazy(() => import('@features/exams/pages/ResultsPage'))
const QuestionsPage = lazy(() => import('@features/questions/browse/pages/QuestionsPage'))
const QuestionPracticePage = lazy(() => import('@features/questions/pages/QuestionPracticePage'))
const FavoritesPage = lazy(() => import('@features/favorites/pages/FavoritesPage'))
const LeaderboardPage = lazy(() => import('@features/leaderboard/pages/LeaderboardPage'))
const LearningProgressPage = lazy(() => import('@features/learning-progress/pages/LearningProgressPage'))
const LogsPage = lazy(() => import('@features/logs/pages/LogsPage'))
const NotificationsPage = lazy(() => import('@features/notifications/pages/NotificationsPage'))
const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const SettingsPage = lazy(() => import('@features/settings/pages/UserSettingsPage'))
const WrongQuestionsPage = lazy(() => import('@features/wrong-questions/pages/WrongQuestionsPage'))
const TasksPage = lazy(() => import('@features/tasks/pages/TasksPage'))
const MyTasksPage = lazy(() => import('@features/tasks/pages/MyTasksPage'))
const PublishTaskPage = lazy(() => import('@features/tasks/pages/PublishTaskPage'))
const TaskDetailPage = lazy(() => import('@features/tasks/pages/TaskDetailPage'))

// ====== Auth ======
const LoginPage = lazy(() => import('@features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@features/auth/pages/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@features/auth/pages/ResetPasswordPage'))

// ====== Admin ======
const AdminPage = lazy(() => import('@features/admin/pages/AdminPage'))
const OrgManage = lazy(() => import('@features/orgs/pages/OrgManagementPage'))
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
const DataAnalyticsPage = lazy(() => import('@features/analytics/pages/AnalyticsDetailsPage'))
const GradeManagementPage = lazy(() => import('@features/analytics/pages/GradeManagementPage'))
const AdminSettingsPage = lazy(() => import('@features/admin-settings/pages/SystemSettingsPage'))
const OrgManagementPage = lazy(() => import('@features/orgs/pages/OrgManagementPage'))
export const router = createBrowserRouter(
  [
    // ===== 公开页 =====
    { path: '/login', element: withSuspense(<LoginPage />) },
    { path: '/register', element: withSuspense(<RegisterPage />) },
    { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
    { path: '/reset-password', element: withSuspense(<ResetPasswordPage />) },

    // ===== 受保护区域（已登录） =====
    {
      path: '/',
      element: <ProtectedLayout />, // 登录校验 + 全局 Layout
      errorElement: <ServerError500 />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: withSuspense(<DashboardPage />) },

        // 顶层业务路由
        { path: 'tasks', element: withSuspense(<TasksPage />) },
        { path: 'tasks/my', element: withSuspense(<MyTasksPage />) },
        { path: 'tasks/publish', element: withSuspense(<PublishTaskPage />) },

        // 题库 & 练习
        { path: 'questions', element: withSuspense(<QuestionsPage />) },
        { path: 'questions/all', element: withSuspense(<QuestionsPage />) },
        { path: 'questions/practice', element: withSuspense(<QuestionPracticePage />) },
        { path: 'questions/:id/practice', element: withSuspense(<QuestionPracticePage />) },
        // 兼容旧地址：重定向到新地址
        { path: 'questions/wrong', loader: () => redirect('/wrong-questions') },

        // 新地址：/wrong-questions
        { path: 'wrong-questions', element: withSuspense(<WrongQuestionsPage />) },

        // 其它业务
        { path: 'results', element: withSuspense(<ResultsPage />) },
        { path: 'notifications', element: withSuspense(<NotificationsPage />) },
        { path: 'learning-progress', element: withSuspense(<LearningProgressPage />) },
        { path: 'learning/progress', loader: () => redirect('/learning-progress') },

        { path: 'leaderboard', element: withSuspense(<LeaderboardPage />) },
        { path: 'favorites', element: withSuspense(<FavoritesPage />) },
        { path: 'discussion', element: withSuspense(<DiscussionPage />) },
        { path: 'logs', element: withSuspense(<LogsPage />) },
        { path: 'analytics', element: withSuspense(<AnalyticsPage />) },
        { path: 'profile', element: withSuspense(<ProfilePage />) },
        { path: 'settings', element: withSuspense(<SettingsPage />) },

        // 考试（同布局，保留单独直达）
        { path: 'exam/list', element: withSuspense(<ExamListPage />) },
        { path: 'exams', element: withSuspense(<ExamListPage />) },
        { path: 'exams/:id', element: withSuspense(<ExamPage />) },

        // 显式错误页
        { path: 'errors/403', element: <Forbidden403 /> },
        { path: 'errors/404', element: <NotFound404 /> },
        { path: 'errors/500', element: <ServerError500 /> },
        { path: 'errors-403', element: <Forbidden403 /> },
        { path: 'errors-404', element: <NotFound404 /> },
        { path: 'errors-500', element: <ServerError500 /> },

        // ===== Admin 区域（需要 admin/teacher） =====
        {
          path: 'admin',
          element: <AdminLayout />,
          children: [
            { path: '', element: withSuspense(<AdminPage />) },

            // 系统管理
            { path: 'orgs', element: withSuspense(<OrgManage />) },
            { path: 'roles', element: withSuspense(<RoleManagementPage />) },
            { path: 'menus', element: withSuspense(<MenuManagementPage />) },
            { path: 'users', element: withSuspense(<UserManagementPage />) },
            { path: 'users/roles', element: withSuspense(<UserRoleManagementPage />) },
          
            // 任务 & 组卷
            { path: 'tasks', element: withSuspense(<TaskManagementPage />) },
            { path: 'tasks/create', element: withSuspense(<TaskCreatePage />) },
            { path: 'papers', element: withSuspense(<PaperManagementPage />) },
            { path: 'papers/create', element: withSuspense(<PaperCreatePage />) },
            { path: 'papers/create/manual', element: withSuspense(<ManualPaperCreationPage />) },
            { path: 'papers/create/smart', element: withSuspense(<SmartPaperCreatePage />) },

            // ===== 题目（REST 风格） =====
            { path: 'questions', element: withSuspense(<QuestionManagementPage />) },
            { path: 'questions/create', element: withSuspense(<QuestionCreatePage />) },
            { path: 'questions/:id', element: withSuspense(<QuestionCreatePage />) }, // 查看
            { path: 'questions/:id/edit', element: withSuspense(<QuestionCreatePage />) }, // 编辑

            // ===== 兼容旧地址：/admin/question-detail/:id 与 /admin/question-edit/:id =====
            {
              path: 'question-detail/:id',
              loader: ({ params }) => redirect(`/admin/questions/${params.id}`),
            },
            {
              path: 'question-edit/:id',
              loader: ({ params }) => redirect(`/admin/questions/${params.id}/edit`),
            },

            // 数据分析 & 后台设置
            { path: 'analytics', element: withSuspense(<DataAnalyticsPage />) },
            { path: 'analytics/grades', element: withSuspense(<GradeManagementPage />) },
            { path: 'settings', element: withSuspense(<AdminSettingsPage />) },

            // 显式无权限
            { path: '403', element: <Forbidden403 /> },
          ],
        },

        // 受保护区域兜底 404
        { path: '*', element: <NotFound404 /> },
      ],
    },

    // 顶层 404（落到未登录或非法路径时）
    { path: '*', element: <NotFound404 /> },
  ]
  // 可选：加上 basename: import.meta.env.BASE_URL（如果有多环境子路径）
)
