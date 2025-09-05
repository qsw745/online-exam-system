// apps/web/src/app/routing/componentRegistry.ts
import { lazy, type ComponentType } from 'react'

// ==== 已存在的业务页面（features） ====
import DashboardPage from '@features/dashboard/pages/DashboardPage'
import AnalyticsPage from '@features/analytics/pages/AnalyticsPage'
import ProfilePage from '@features/profile/pages/ProfilePage'
import ResultsPage from '@features/exams/pages/ResultsPage'
import QuestionPracticePage from '@features/questions/pages/QuestionPracticePage'
import QuestionsPage from '@features/questions/pages/QuestionsPage'
import DiscussionPage from '@features/discussions/pages/DiscussionPage'
import FavoritesPage from '@features/favorites/pages/FavoritesPage'
import LeaderboardPage from '@features/leaderboard/pages/LeaderboardPage'
import LearningProgressPage from '@features/learning-progress/pages/LearningProgressPage'
import LogsPage from '@features/logs/pages/LogsPage'
import NotificationsPage from '@features/notifications/pages/NotificationsPage'
import SettingsPage from '@features/settings/pages/SettingsPage'
import TasksPage from '@features/tasks/pages/TasksPage'
import WrongQuestionsPage from '@features/wrong-questions/pages/WrongQuestionsPage'
import OrgManage from '@features/orgs/pages/OrgManage'

// ✅ 新增真实页
import MyTasksPage from '@features/tasks/pages/MyTasksPage'
import PublishTaskPage from '@features/tasks/pages/PublishTaskPage'

// 菜单管理
const MenuManagePage = lazy(() => import('@features/menu/pages/MenuManagementPage'))

// 错误页
import NotFound404 from '@app/errors/NotFound404'
const Error403 = lazy(() => import('@app/errors/Forbidden403'))
const Error404 = lazy(() => import('@app/errors/NotFound404'))
const Error500 = lazy(() => import('@app/errors/ServerError500'))

// 懒加载
const ExamListPage = lazy(() => import('@features/exams/pages/ExamListPage'))

// 暂未实现/找不到原文件的页面
const RoleManagementPage = NotFound404
const UserManagementPage = NotFound404

export const ComponentRegistry: Record<string, ComponentType<any>> = {
  // 基础
  dashboard: DashboardPage,
  analytics: AnalyticsPage,
  profile: ProfilePage,

  // 考试
  'exam-list': ExamListPage,
  results: ResultsPage,
  'question-practice': QuestionPracticePage,

  // 题库
  questions: QuestionsPage,

  // 用户/系统
  'user-manage': UserManagementPage,
  'admin-org': OrgManage,
  'admin-role': RoleManagementPage,
  settings: SettingsPage,
  logs: LogsPage,
  notifications: NotificationsPage,
  tasks: TasksPage,
  'menu-manage': MenuManagePage,

  // 学习中心
  'learning-progress': LearningProgressPage,
  favorites: FavoritesPage,
  'wrong-questions': WrongQuestionsPage,
  discussion: DiscussionPage,
  leaderboard: LeaderboardPage,

  // ✅ 我的任务 / 发布任务（供动态路由用的 key）
  'task-my': MyTasksPage,
  'task-publish': PublishTaskPage,

  // 错误页
  errors: NotFound404,
  'errors-403': Error403,
  'errors-404': Error404,
  'errors-500': Error500,

  // 兜底
  __404__: NotFound404,
}
