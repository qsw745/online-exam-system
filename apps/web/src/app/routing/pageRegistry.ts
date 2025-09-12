// apps/web/src/app/routing/pageRegistry.ts
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

// ===== Admin / System =====
const AdminPage = lazy(() => import('@/features/admin/pages/AdminPage'))
const OrgManagementPage = lazy(() => import('@/features/orgs/pages/OrgManagementPage'))
const RoleManagementPage = lazy(() => import('@/features/roles/pages/RoleManagementPage'))
const MenuManagementPage = lazy(() => import('@/features/menu/pages/MenuManagementPage'))
const FunctionMenusPage = lazy(() => import('@/features/menu/pages/FunctionMenusPage')) // 功能菜单（只读树）
const UnitMenusPage = lazy(() => import('@/features/menu/pages/UnitMenusPage')) // 单位菜单（可维护）
const UserManagementPage = lazy(() => import('@/features/users/pages/UserManagementPage'))
const LogsPage = lazy(() => import('@/features/logs/pages/LogsPage'))
const SystemSettingsPage = lazy(() => import('@/features/admin-settings/pages/SystemSettingsPage'))

// ===== Tasks =====
const TasksPage = lazy(() => import('@/features/tasks/pages/TasksPage'))
const MyTasksPage = lazy(() => import('@/features/tasks/pages/MyTasksPage'))
const PublishTaskPage = lazy(() => import('@/features/tasks/pages/PublishTaskPage'))
const TaskManagementPage = lazy(() => import('@/features/tasks/pages/TaskManagementPage'))
const TaskCreatePage = lazy(() => import('@/features/tasks/pages/TaskCreatePage'))

// ===== Papers / Questions =====
const PaperManagementPage = lazy(() => import('@/features/papers/pages/PaperManagementPage'))
const PaperCreatePage = lazy(() => import('@/features/papers/pages/PaperCreatePage'))
const ManualPaperCreationPage = lazy(() => import('@/features/papers/pages/ManualPaperCreationPage'))
const SmartPaperCreatePage = lazy(() => import('@/features/papers/pages/SmartPaperCreatePage'))
const QuestionManagementPage = lazy(() => import('@/features/questions/pages/QuestionManagementPage'))
const QuestionCreatePage = lazy(() => import('@/features/questions/pages/QuestionCreatePage'))

// ===== Top-level user features =====
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const AnalyticsOverviewPage = lazy(() => import('@/features/analytics/pages/AnalyticsOverviewPage'))
const AnalyticsDetailsPage = lazy(() => import('@/features/analytics/pages/AnalyticsDetailsPage'))
const GradeManagementPage = lazy(() => import('@/features/analytics/pages/GradeManagementPage'))
const DiscussionPage = lazy(() => import('@/features/discussions/pages/DiscussionPage'))
const ExamListPage = lazy(() => import('@/features/exams/pages/ExamListPage'))
const ExamPage = lazy(() => import('@/features/exams/pages/ExamPage'))
const ResultsPage = lazy(() => import('@/features/exams/pages/ResultsPage'))
const QuestionsPage = lazy(() => import('@/features/questions/browse/pages/QuestionsPage'))
const QuestionPracticePage = lazy(() => import('@/features/questions/pages/QuestionPracticePage'))
const FavoritesPage = lazy(() => import('@/features/favorites/pages/FavoritesPage'))
const LeaderboardPage = lazy(() => import('@/features/leaderboard/pages/LeaderboardPage'))
const LearningProgressPage = lazy(() => import('@/features/learning-progress/pages/LearningProgressPage'))
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'))
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'))
const UserSettingsPage = lazy(() => import('@/features/settings/pages/UserSettingsPage'))
const WrongQuestionsPage = lazy(() => import('@/features/wrong-questions/pages/WrongQuestionsPage'))

// ===== Errors =====
const Forbidden403 = lazy(() => import('@/app/errors/Forbidden403'))
const NotFound404 = lazy(() => import('@/app/errors/NotFound404'))
const ServerError500 = lazy(() => import('@/app/errors/ServerError500'))

/**
 * 组件注册表（key 必须与后端 MENU_TREE 的 `component` 一致）
 */
export const componentRegistry: Record<string, LazyExoticComponent<ComponentType<any>>> = {
  // 顶层
  dashboard: DashboardPage,
  analytics: AnalyticsOverviewPage,
  'analytics-detail': AnalyticsDetailsPage,
  'grade-management': GradeManagementPage,
  discussion: DiscussionPage,
  'exam-list': ExamListPage,
  exam: ExamPage,
  results: ResultsPage,
  questions: QuestionsPage,
  'question-practice': QuestionPracticePage,
  favorites: FavoritesPage,
  leaderboard: LeaderboardPage,
  'learning-progress': LearningProgressPage,
  notifications: NotificationsPage,
  profile: ProfilePage,
  settings: UserSettingsPage,
  'wrong-questions': WrongQuestionsPage,

  // Admin
  'admin-home': AdminPage,
  'admin-org': OrgManagementPage,
  'admin-role': RoleManagementPage,
  'menu-manage': MenuManagementPage,
  'menu-functions': FunctionMenusPage, // ✅ 和种子一致
  'menu-units': UnitMenusPage, // ✅ 和种子一致
  'user-manage': UserManagementPage,
  logs: LogsPage,
  'system-settings': SystemSettingsPage,

  // Tasks
  tasks: TasksPage,
  'task-my': MyTasksPage,
  'task-publish': PublishTaskPage,
  'task-manage': TaskManagementPage,
  'task-create': TaskCreatePage,

  // Papers & Questions (后台)
  'paper-manage': PaperManagementPage,
  'paper-create': PaperCreatePage,
  'paper-create-manual': ManualPaperCreationPage,
  'paper-create-smart': SmartPaperCreatePage,
  'question-manage': QuestionManagementPage,
  'question-create': QuestionCreatePage,

  // Errors
  'errors-403': Forbidden403,
  'errors-404': NotFound404,
  'errors-500': ServerError500,
}
