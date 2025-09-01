// src/routes/componentRegistry.ts
import React, { lazy } from 'react'

import DashboardPage from '../pages/DashboardPage'
import AnalyticsPage from '../pages/AnalyticsPage'
import OrgManage from '../pages/admin/OrgManage'
import RoleManagementPage from '../pages/admin/RoleManagementPage'
import NotFound404 from '../pages/errors/NotFound404'

// 其余常规页
import QuestionsPage from '../pages/QuestionsPage'
import ResultsPage from '../pages/ResultsPage'
import QuestionPracticePage from '../pages/QuestionPracticePage'
import SettingsPage from '../pages/SettingsPage'
import LogsPage from '../pages/LogsPage'
import NotificationsPage from '../pages/NotificationsPage'
import TasksPage from '../pages/TasksPage'
import FavoritesPage from '../pages/FavoritesPage'
import LearningProgressPage from '../pages/LearningProgressPage'
import WrongQuestionsPage from '../pages/WrongQuestionsPage'
import DiscussionPage from '../pages/DiscussionPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import ProfilePage from '../pages/ProfilePage'

// 懒加载示例
const ExamListPage = lazy(() => import('../pages/ExamListPage'))

// 错误页（如果你有独立文件，按需引入；没有就让前端统一到 NotFound/内置）
const Error403 = lazy(() => import('../pages/errors/Forbidden403')) // 若文件名不同请改成真实路径
const Error404 = lazy(() => import('../pages/errors/NotFound404'))
const Error500 = lazy(() => import('../pages/errors/ServerError500'))

// 菜单管理页面（按你的文件路径）
const MenuManagePage = lazy(() => import('../pages/admin/MenuManagementPage'))
const UserManagementPage = lazy(() => import('../pages/admin/UserManagementPage'))

export const ComponentRegistry: Record<string, React.ComponentType<any>> = {
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

  // 错误页管理
  errors: NotFound404, // 如果你有一个“错误页汇总页面”，改成那个组件
  'errors-403': Error403,
  'errors-404': Error404,
  'errors-500': Error500,

  // 兜底
  __404__: NotFound404,
}
