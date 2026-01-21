import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/** ---------------- 手动注册（兼容旧方案：用 key） ---------------- */
const AdminPage = lazy(() => import('@/features/admin/pages/AdminPage'))
const OrgManagementPage = lazy(() => import('@/features/orgs/pages/OrgManagementPage'))
const RoleManagementPage = lazy(() => import('@/features/roles/pages/RoleManagementPage'))

const UserManagementPage = lazy(() => import('@/features/users/pages/UserManagementPage'))
const SystemSettingsPage = lazy(() => import('@/features/admin-settings/pages/SystemSettingsPage'))

const MenusListPage= lazy(()=> import('@/features/menu/pages/MenusListPage'))
const MyTasksPage = lazy(() => import('@/features/tasks/pages/MyTasksPage'))
const TaskListPage = lazy(() => import('@/features/tasks/pages/TaskListPage'))
const TaskCreatePage = lazy(() => import('@/features/tasks/pages/TaskCreatePage'))
const TaskDetailPage = lazy(() => import('@/features/tasks/pages/TaskDetailPage'))

const PaperManagementPage = lazy(() => import('@/features/papers/pages/PaperManagementPage'))
const PaperCreatePage = lazy(() => import('@/features/papers/pages/PaperCreatePage'))
const PaperManualCreatePage = lazy(() => import('@/features/papers/pages/PaperManualCreatePage'))
const SmartPaperCreatePage = lazy(() => import('@/features/papers/pages/SmartPaperCreatePage'))
const PaperDetailPage = lazy(() => import('@/features/papers/pages/PaperDetailPage'))

const QuestionManagementPage = lazy(() => import('@/features/questions/pages/QuestionManagementPage'))
const QuestionCreatePage = lazy(() => import('@/features/questions/pages/QuestionCreatePage'))
const QuestionDetailPage = lazy(() => import('@/features/questions/pages/QuestionDetailPage'))
const QuestionEditPage = lazy(() => import('@/features/questions/pages/QuestionEditPage'))

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const AnalyticsOverviewPage = lazy(() => import('@/features/analytics/pages/AnalyticsOverviewPage'))
const AnalyticsDetailsPage = lazy(() => import('@/features/analytics/pages/AnalyticsDetailsPage'))
const GradeManagementPage = lazy(() => import('@/features/analytics/pages/GradeManagementPage'))
const DiscussionPage = lazy(() => import('@/features/discussions/pages/DiscussionPage'))
const ExamListPage = lazy(() => import('@/features/exams/pages/ExamListPage'))
const ExamPage = lazy(() => import('@/features/exams/pages/ExamPage'))
const ResultsPage = lazy(() => import('@/features/exams/pages/ResultsPage'))
const ExamReviewPage = lazy(() => import('@/features/exams/pages/ExamReviewPage'))
const QuestionsPage = lazy(() => import('@/features/questions/browse/pages/QuestionsPage'))
const QuestionPracticePage = lazy(() => import('@/features/questions/pages/QuestionPracticePage'))
const FavoritesPage = lazy(() => import('@/features/favorites/pages/FavoritesPage'))
const LeaderboardPage = lazy(() => import('@/features/leaderboard/pages/LeaderboardPage'))
const LearningProgressPage = lazy(() => import('@/features/learning-progress/pages/LearningProgressPage'))
const NotificationsPage = lazy(() => import('@/features/notifications-manager/pages/NotificationsPage'))
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'))
const UserSettingsPage = lazy(() => import('@/features/settings/pages/UserSettingsPage'))
const WrongQuestionsPage = lazy(() => import('@/features/wrong-questions/pages/WrongQuestionsPage'))
const LoginLogsPage = lazy(() => import('@/features/logs/pages/LoginLogsPage'))
const OperationLogsPage = lazy(() => import('@/features/logs/pages/OperationLogsPage'))
const SystemLogsPage = lazy(() => import('@/features/logs/pages/SystemLogsPage'))
const OnlineUsersPage = lazy(() => import('@/features/logs/pages/OnlineUsersPage'))
const FilesLibraryPage = lazy(() => import('@/features/files/pages/FilesLibraryPage'))
const FilesUploadPage = lazy(() => import('@/features/files/pages/FilesUploadPage'))
const DictManagementPage = lazy(() => import('@/features/system/pages/DictManagementPage'))
const SystemConfigPage = lazy(() => import('@/features/system/pages/SystemConfigPage'))
const SystemJobsPage = lazy(() => import('@/features/system/pages/SystemJobsPage'))
const CacheManagementPage = lazy(() => import('@/features/system/pages/CacheManagementPage'))
const IntegrationsWebhooksPage = lazy(() => import('@/features/system/pages/IntegrationsWebhooksPage'))
const IntegrationsOauthPage = lazy(() => import('@/features/system/pages/IntegrationsOauthPage'))
const MailInboxPage = lazy(() => import('@/features/mail/pages/MailInboxPage'))
const MailComposePage = lazy(() => import('@/features/mail/pages/MailComposePage'))
const MailSentPage = lazy(() => import('@/features/mail/pages/MailSentPage'))
const MailDraftPage = lazy(() => import('@/features/mail/pages/MailDraftPage'))

// Notification Center / Manager
const InboxPage = lazy(() => import('@/features/notification-center/pages/InboxPage'))
const AnnouncementsPage = lazy(() => import('@/features/notification-center/pages/AnnouncementsPage'))
const SubscriptionPreferencesPage = lazy(
  () => import('@/features/notification-center/pages/SubscriptionPreferencesPage')
)
const AnnouncementManagementPage = lazy(
  () => import('@/features/notifications-manager/pages/AnnouncementManagementPage')
)
const MessageTemplatesPage = lazy(() => import('@/features/notifications-manager/pages/MessageTemplatesPage'))
const ChannelsPage = lazy(() => import('@/features/notifications-manager/pages/ChannelsPage'))
const BroadcastAndTestPage = lazy(() => import('@/features/notifications-manager/pages/BroadcastAndTestPage'))
const PushLogsPage = lazy(() => import('@/features/notifications-manager/pages/PushLogsPage'))
const AiLogsPage = lazy(() => import('@/features/ai-logs/pages/AiLogsPage'))
const WorkflowTemplatesPage = lazy(() => import('@/features/workflows/pages/WorkflowTemplatesPage'))
const WorkflowTasksPage = lazy(() => import('@/features/workflows/pages/WorkflowTasksPage'))

// Errors
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
  'exam-reviews': ExamReviewPage,
  'result-detail': PaperDetailPage,
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

  'user-manage': UserManagementPage,
  'admin-user': UserManagementPage,
  'menu-list': MenusListPage,
  'system-settings': SystemSettingsPage,
  'files-library': FilesLibraryPage,
  'files-uploads': FilesUploadPage,
  'system-dict': DictManagementPage,
  'system-config': SystemConfigPage,
  'system-jobs': SystemJobsPage,
  'system-cache': CacheManagementPage,
  'integrations-webhooks': IntegrationsWebhooksPage,
  'integrations-oauth': IntegrationsOauthPage,
  'mail-inbox': MailInboxPage,
  'mail-compose': MailComposePage,
  'mail-sent': MailSentPage,
  'mail-draft': MailDraftPage,

  // Tasks
  'task-my': MyTasksPage,
  'task-manage': TaskListPage,
  'task-create': TaskCreatePage,
  'task-detail': TaskDetailPage,

  // Papers & Questions
  'paper-manage': PaperManagementPage,
  'paper-create': PaperCreatePage,
  'paper-create-manual': PaperManualCreatePage,
  'paper-create-smart': SmartPaperCreatePage,
  'paper-detail': PaperDetailPage,

  'question-manage': QuestionManagementPage,
  'question-create': QuestionCreatePage,
  'question-detail': QuestionDetailPage,
  'question-edit': QuestionEditPage,

  // Logs
  'logs-login': LoginLogsPage,
  'logs-ops': OperationLogsPage,
  'logs-system': SystemLogsPage,
  'online-users': OnlineUsersPage,
  'ai-logs': AiLogsPage,

  // Notification Center
  'notify-inbox': InboxPage,
  'notify-announcements': AnnouncementsPage,
  'notify-preferences': SubscriptionPreferencesPage,

  // Notification Manager
  'notify-announce-manage': AnnouncementManagementPage,
  'notify-template': MessageTemplatesPage,
  'notify-channel': ChannelsPage,
  'notify-send': BroadcastAndTestPage,
  'notify-log': PushLogsPage,
  'workflow-templates': WorkflowTemplatesPage,
  'workflow-tasks': WorkflowTasksPage,

  // Errors
  'errors-403': Forbidden403,
  'errors-404': NotFound404,
  'errors-500': ServerError500,
}

/** ---------------- 动态路径解析（新） ----------------
 * 支持后端直接下发源码相对路径：
 *   "@/features/notification-center/pages/InboxPage"
 *   "features/notification-center/pages/InboxPage"
 *   也支持缺省扩展名（自动尝试 .tsx/.jsx 与 /index）
 */
const globPages = import.meta.glob([
  '/src/features/**/pages/**/*.{tsx,jsx}',
  '/src/app/errors/*.{tsx,jsx}',
  '/src/app/**/pages/**/*.{tsx,jsx}',
])

function normalizeToSrcPath(id: string) {
  let p = id.trim()
  if (!p) return null
  // 去掉开头的 @ -> /src
  if (p.startsWith('@/')) p = p.replace(/^@/, '/src')
  // 相对写法补全 /src
  if (!p.startsWith('/src/')) p = '/src/' + p.replace(/^\/+/, '')
  // 去掉扩展，后面会补候选
  p = p.replace(/\.(tsx|jsx)$/, '')
  return p
}

function collectCandidates(id: string): string[] {
  const base = normalizeToSrcPath(id)
  if (!base) return []
  return [`${base}.tsx`, `${base}.jsx`, `${base}/index.tsx`, `${base}/index.jsx`]
}

/** 统一解析：优先 key，其次按源码路径动态引入 */
export function resolveComponent(keyOrPath: string): LazyExoticComponent<ComponentType<any>> | undefined {
  const byKey = componentRegistry[keyOrPath]
  if (byKey) return byKey

  // 只有包含 "/" 我们才认为它是“路径模式”
  if (!keyOrPath.includes('/')) return undefined

  const candidates = collectCandidates(keyOrPath)
  for (const p of candidates) {
    const loader = (globPages as any)[p]
    if (loader) {
      return lazy(loader as () => Promise<{ default: ComponentType<any> }>)
    }
  }
  return undefined
}

export default componentRegistry
