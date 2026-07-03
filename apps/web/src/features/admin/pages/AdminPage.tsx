// src/features/admin/pages/AdminPage.tsx
import { UserOutlined } from '@ant-design/icons'
import { BarChart3, BookMarked, Clock, FileQuestion, Home, Settings, Users } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'

// shared
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useAuth } from '@/shared/contexts/AuthContext'

// ✅ 全部改为各自 feature 的路径
import QuestionCreatePage from '@/features/questions/pages/QuestionCreatePage'
import QuestionManagementPage from '@/features/questions/pages/QuestionManagementPage'

import ManualPaperCreationPage from '@/features/papers/pages/ManualPaperCreationPage'
import PaperCreatePage from '@/features/papers/pages/PaperCreatePage'
import PaperManagementPage from '@/features/papers/pages/PaperManagementPage'
import SmartPaperCreatePage from '@/features/papers/pages/SmartPaperCreatePage'

import TaskCreatePage from '@/features/tasks/pages/TaskCreatePage'

import UserManagementPage from '@/features/users/pages/UserManagementPage'

import DataAnalyticsPage from '@/features/analytics/pages/AnalyticsDetailsPage'
import GradeManagementPage from '@/features/analytics/pages/GradeManagementPage'

import RoleManagementPage from '@/features/roles/pages/RoleManagementPage'

import NotificationManagementPage from '@/features/notifications-manager/pages/NotificationManagementPage'
import SettingsPage from '@/features/settings/pages/UserSettingsPage'
import { translate } from '@/shared/utils/i18n'

interface NavItem {
  name: string
  path: string
  icon: React.ReactNode
}

export default function AdminPage() {
  const location = useLocation()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        setLoading(true)
        // TODO: 管理员权限检查
      } catch (error) {
        console.error('检查管理员权限失败:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAdminAccess()
  }, [user])

  const navItems: NavItem[] = [
    { name: translate('auto.5060421d15'), path: '/admin', icon: <Home className="w-5 h-5" /> },
    { name: translate('menus.admin-user'), path: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { name: translate('questions.mgmt_title'), path: '/admin/questions', icon: <FileQuestion className="w-5 h-5" /> },
    { name: translate('menus.admin-papers'), path: '/admin/papers', icon: <BookMarked className="w-5 h-5" /> },
    { name: translate('menus.exam-admin'), path: '/admin/tasks', icon: <Clock className="w-5 h-5" /> },
    { name: translate('menus.system-menus'), path: '/admin/menus', icon: <Settings className="w-5 h-5" /> },
    { name: translate('menus.admin-role'), path: '/admin/roles', icon: <UserOutlined style={{ fontSize: 20 }} /> },
    { name: translate('menus.analytics'), path: '/admin/analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { name: translate('menus.system-settings'), path: '/admin/settings', icon: <Settings className="w-5 h-5" /> },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 侧边栏（需要显示就把 display:none 移除） */}
      <aside style={{ display: 'none' }} className="w-64 bg-white shadow-sm">
        <nav className="p-4 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/users" element={<UserManagementPage />} />

          <Route path="/questions" element={<QuestionManagementPage />} />
          <Route path="/questions/browse" element={<QuestionManagementPage />} />
          <Route path="/questions/manage" element={<QuestionManagementPage />} />
          <Route path="/questions/favorites" element={<QuestionManagementPage />} />
          <Route path="/question-create" element={<QuestionCreatePage />} />
          <Route path="/question-detail/:id" element={<QuestionCreatePage />} />
          <Route path="/question-edit/:id" element={<QuestionCreatePage />} />

          <Route path="/papers" element={<PaperManagementPage />} />
          <Route path="/papers/list" element={<PaperManagementPage />} />
          <Route path="/papers/create" element={<ManualPaperCreationPage />} />
          <Route path="/paper-create" element={<PaperCreatePage />} />
          <Route path="/smart-paper-create" element={<SmartPaperCreatePage />} />
          <Route path="/paper-detail/:id" element={<PaperCreatePage />} />
          <Route path="/paper-edit/:id" element={<PaperCreatePage />} />

          <Route path="/task-create" element={<TaskCreatePage />} />
          <Route path="/task-edit/:id" element={<TaskCreatePage />} />
          <Route path="/task-detail/:id" element={<TaskCreatePage />} />

          <Route path="/analytics" element={<DataAnalyticsPage />} />
          <Route path="/grades" element={<GradeManagementPage />} />

          <Route path="/roles" element={<RoleManagementPage />} />
          <Route path="/notifications" element={<NotificationManagementPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}
