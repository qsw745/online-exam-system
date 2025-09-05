// src/app/routing/pageRegistry.ts
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

// Admin
const AdminPage = lazy(() => import('@features/admin/pages/AdminPage'))
const UserManagementPage = lazy(() => import('@features/users/pages/UserManagementPage'))
const QuestionManagementPage = lazy(() => import('@features/questions/pages/QuestionManagementPage'))
const QuestionCreatePage = lazy(() => import('@features/questions/pages/QuestionCreatePage'))
const PaperManagementPage = lazy(() => import('@features/papers/pages/PaperManagementPage'))
const PaperCreatePage = lazy(() => import('@features/papers/pages/PaperCreatePage'))
const TaskManagementPage = lazy(() => import('@features/tasks/pages/TaskManagementPage'))
const TaskCreatePage = lazy(() => import('@features/tasks/pages/TaskCreatePage'))
const MenuManagementPage = lazy(() => import('@features/menu/pages/MenuManagementPage'))
const DataAnalyticsPage = lazy(() => import('@features/analytics/pages/DataAnalyticsPage'))
const GradeManagementPage = lazy(() => import('@features/analytics/pages/GradeManagementPage'))

// User / 顶层业务
const DashboardPage = lazy(() => import('@features/dashboard/pages/DashboardPage'))
const ExamListPage = lazy(() => import('@features/exams/pages/ExamListPage'))
const ExamPage = lazy(() => import('@features/exams/pages/ExamPage'))
const ResultsPage = lazy(() => import('@features/exams/pages/ResultsPage'))
const QuestionPracticePage = lazy(() => import('@features/questions/pages/QuestionPracticePage'))
const QuestionsPage = lazy(() => import('@features/questions/pages/QuestionsPage'))
const FavoritesPage = lazy(() => import('@features/favorites/pages/FavoritesPage'))
const LeaderboardPage = lazy(() => import('@features/leaderboard/pages/LeaderboardPage'))
const LearningProgressPage = lazy(() => import('@features/learning-progress/pages/LearningProgressPage'))
const LogsPage = lazy(() => import('@features/logs/pages/LogsPage'))
const NotificationsPage = lazy(() => import('@features/notifications/pages/NotificationsPage'))
const ProfilePage = lazy(() => import('@features/profile/pages/ProfilePage'))
const SettingsPage = lazy(() => import('@features/settings/pages/SettingsPage'))
const WrongQuestionsPage = lazy(() => import('@features/wrong-questions/pages/WrongQuestionsPage'))

// 统一导出：路径 => 懒组件
export const pageRegistry: Record<string, LazyExoticComponent<ComponentType<any>>> = {
  // Admin（按需扩展）
  '/admin': AdminPage,
  '/admin/users': UserManagementPage,
  '/admin/questions': QuestionManagementPage,
  '/admin/question-create': QuestionCreatePage,
  '/admin/questions/create': QuestionCreatePage,
  '/admin/papers': PaperManagementPage,
  '/admin/paper-create': PaperCreatePage,
  '/admin/tasks': TaskManagementPage,
  '/admin/task-create': TaskCreatePage,
  '/admin/menus': MenuManagementPage,
  '/admin/analytics': DataAnalyticsPage,
  '/admin/grades': GradeManagementPage,

  // User / 顶层
  '/dashboard': DashboardPage,
  '/exams': ExamListPage,
  '/exam': ExamPage,
  '/exam/list': ExamListPage,
  '/practice': QuestionPracticePage,
  '/results': ResultsPage,
  '/profile': ProfilePage,
  '/learning-progress': LearningProgressPage,
 
  '/favorites': FavoritesPage,

  '/wrong-questions': WrongQuestionsPage,
  '/discussion': LeaderboardPage, // 如有专门页面可替换为 DiscussionPage
  '/leaderboard': LeaderboardPage,
  '/logs': LogsPage,
  '/analytics': DataAnalyticsPage, // 也可放在 /admin/analytics，仅示例
  '/settings': SettingsPage,
  '/notifications': NotificationsPage,
  '/questions': QuestionsPage,
  '/questions/practice': QuestionPracticePage,
}
