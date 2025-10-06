import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

// ===== Admin / System =====
const AdminPage = lazy(() => import('@/features/admin/pages/AdminPage'))
const OrgManagementPage = lazy(() => import('@/features/orgs/pages/OrgManagementPage'))
const RoleManagementPage = lazy(() => import('@/features/roles/pages/RoleManagementPage'))
const MenuManagementPage = lazy(() => import('@/features/menu/pages/MenuManagementPage'))
const SystemMenusPage =lazy(()=> import('@/features/menu/pages/SystemMenusPage'))
const UnitMenusPage = lazy(() => import('@/features/menu/pages/UnitMenusPage'))
const UserManagementPage = lazy(() => import('@/features/users/pages/UserManagementPage'))

const SystemSettingsPage = lazy(() => import('@/features/admin-settings/pages/SystemSettingsPage'))

// ===== Tasks =====
const MyTasksPage = lazy(() => import('@/features/tasks/pages/MyTasksPage'))
const TaskListPage = lazy(() => import('@/features/tasks/pages/TaskListPage'))
const TaskCreatePage = lazy(() => import('@/features/tasks/pages/TaskCreatePage'))
const TaskDetailPage = lazy(() => import('@/features/tasks/pages/TaskDetailPage'))

// ===== Papers / Questions =====
const PaperManagementPage = lazy(() => import('@/features/papers/pages/PaperManagementPage'))
const PaperCreatePage = lazy(() => import('@/features/papers/pages/PaperCreatePage'))
const PaperManualCreatePage = lazy(() => import('@/features/papers/pages/PaperManualCreatePage'))
const SmartPaperCreatePage = lazy(() => import('@/features/papers/pages/SmartPaperCreatePage'))
const PaperDetailPage = lazy(() => import('@/features/papers/pages/PaperDetailPage')) // ✅ 新增

const QuestionManagementPage = lazy(() => import('@/features/questions/pages/QuestionManagementPage'))
const QuestionCreatePage = lazy(() => import('@/features/questions/pages/QuestionCreatePage'))
const QuestionDetailPage = lazy(() => import('@/features/questions/pages/QuestionDetailPage'))
const QuestionEditPage = lazy(() => import('@/features/questions/pages/QuestionEditPage'))
const ResultDetailPage = lazy(() => import('@/features/exams/pages/ResultDetailPage'))

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
const LoginLogsPage = lazy(() => import('@/features/logs/pages/LoginLogsPage'))
const OperationLogsPage = lazy(() => import('@/features/logs/pages/OperationLogsPage'))
const SystemLogsPage = lazy(() => import('@/features/logs/pages/SystemLogsPage'))

// 可选：在线用户
const OnlineUsersPage = lazy(() => import('@/features/logs/pages/OnlineUsersPage'))

// ===== Errors =====
const Forbidden403 = lazy(() => import('@/app/errors/Forbidden403'))
const NotFound404 = lazy(() => import('@/app/errors/NotFound404'))
const ServerError500 = lazy(() => import('@/app/errors/ServerError500'))

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
  'result-detail': ResultDetailPage,
  questions: QuestionsPage,
  'question-practice': QuestionPracticePage,
  favorites: FavoritesPage,
  leaderboard: LeaderboardPage,
  'learning-progress': LearningProgressPage,
  notifications: NotificationsPage,
  profile: ProfilePage,

  'wrong-questions': WrongQuestionsPage,

  // Admin
  'admin-home': AdminPage,
  'admin-org': OrgManagementPage,
  'admin-role': RoleManagementPage,

  //   'menu-functions': MenuManagementPage,
  'menu-functions': SystemMenusPage,
  'menu-units': UnitMenusPage,
  'user-manage': UserManagementPage,
  'admin-user': UserManagementPage, // 兼容

  'system-settings': SystemSettingsPage,

  // Tasks
  'task-my': MyTasksPage,
  'task-manage': TaskListPage,
  'task-create': TaskCreatePage,
  'task-detail': TaskDetailPage,

  // Papers & Questions (后台)
  'paper-manage': PaperManagementPage,
  'paper-create': PaperCreatePage,
  'paper-create-manual': PaperManualCreatePage,
  'paper-create-smart': SmartPaperCreatePage,
  'paper-detail': PaperDetailPage, // ✅ 新增

  'question-manage': QuestionManagementPage,
  'question-create': QuestionCreatePage,
  'question-detail': QuestionDetailPage,
  'question-edit': QuestionEditPage,

  //   Logs
  // ✅ 日志中心
  'logs-login': LoginLogsPage,
  'logs-ops': OperationLogsPage,
  'logs-system': SystemLogsPage,

  // 可选：在线用户
  'online-users': OnlineUsersPage,
  // Errors
  'errors-403': Forbidden403,
  'errors-404': NotFound404,
  'errors-500': ServerError500,
}
