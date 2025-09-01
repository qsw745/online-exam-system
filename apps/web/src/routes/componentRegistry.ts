import React, { lazy } from 'react'

import DashboardPage from '../pages/DashboardPage'
import AnalyticsPage from '../pages/AnalyticsPage'
import OrgManage from '../pages/admin/OrgManage'
import RoleManagementPage from '../pages/admin/RoleManagementPage'
import NotFound404 from '../pages/errors/NotFound404'

// 常规页
import QuestionsPage from '../pages/QuestionsPage'
import ResultsPage from '../pages/ResultsPage'
import QuestionPracticePage from '../pages/QuestionPracticePage'
import SettingsPage from '../pages/SettingsPage'
import LogsPage from '../pages/LogsPage'
import NotificationsPage from '../pages/NotificationsPage'
import TasksPage from '../pages/TasksPage' // 原有的“任务管理”总页
import FavoritesPage from '../pages/FavoritesPage'
import LearningProgressPage from '../pages/LearningProgressPage'
import WrongQuestionsPage from '../pages/WrongQuestionsPage'
import DiscussionPage from '../pages/DiscussionPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import ProfilePage from '../pages/ProfilePage'

// 懒加载示例
const ExamListPage = lazy(() => import('../pages/ExamListPage'))

// 错误页
const Error403 = lazy(() => import('../pages/errors/Forbidden403'))
const Error404 = lazy(() => import('../pages/errors/NotFound404'))
const Error500 = lazy(() => import('../pages/errors/ServerError500'))

// 菜单管理 / 用户管理
const MenuManagePage = lazy(() => import('../pages/admin/MenuManagementPage'))
const UserManagementPage = lazy(() => import('../pages/admin/UserManagementPage'))

// ⬇️ 新增：我的任务 / 发布任务页面
const MyTasksPage = lazy(() => import('../pages/tasks/MyTasksPage'))
const PublishTaskPage = lazy(() => import('../pages/tasks/PublishTaskPage'))

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
  tasks: TasksPage, // 原“任务管理”
  'menu-manage': MenuManagePage,

  // 学习中心
  'learning-progress': LearningProgressPage,
  favorites: FavoritesPage,
  'wrong-questions': WrongQuestionsPage,
  discussion: DiscussionPage,
  leaderboard: LeaderboardPage,

  // 新增映射
  'task-my': MyTasksPage, // 我的任务
  'task-publish': PublishTaskPage, // 发布任务

  // 错误页管理
  errors: NotFound404,
  'errors-403': Error403,
  'errors-404': Error404,
  'errors-500': Error500,

  // 兜底
  __404__: NotFound404,
}
