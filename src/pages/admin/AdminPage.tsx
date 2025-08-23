import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { 
  Settings, 
  Users, 
  FileQuestion, 
  BookMarked, 
  Clock, 
  BarChart3,
  Home,
  TrendingUp,
  Award
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import QuestionManagementPage from './QuestionManagementPage'
import QuestionCreatePage from './QuestionCreatePage'
import PaperManagementPage from './PaperManagementPage'
import ManualPaperCreationPage from './ManualPaperCreationPage'
import PaperCreatePage from './PaperCreatePage'
import SmartPaperCreatePage from './SmartPaperCreatePage'
import TaskManagementPage from './TaskManagementPage'
import TaskCreatePage from './TaskCreatePage'
import UserManagementPage from './UserManagementPage'
import DataAnalyticsPage from './DataAnalyticsPage'
import GradeManagementPage from './GradeManagementPage'
import MenuManagementPage from './MenuManagementPage'
import RoleManagementPage from './RoleManagementPage'
import UserRoleManagementPage from './UserRoleManagementPage'

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
        // 在这里可以添加管理员权限检查的逻辑
      } catch (error) {
        console.error('检查管理员权限失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkAdminAccess()
  }, [user])
  
  const navItems: NavItem[] = [
    { name: '概览', path: '/admin', icon: <Home className="w-5 h-5" /> },
    { name: '用户管理', path: '/admin/users', icon: <Users className="w-5 h-5" /> },
    { name: '题目管理', path: '/admin/questions', icon: <FileQuestion className="w-5 h-5" /> },
    { name: '试卷管理', path: '/admin/papers', icon: <BookMarked className="w-5 h-5" /> },
    { name: '考试管理', path: '/admin/tasks', icon: <Clock className="w-5 h-5" /> },
    { name: '菜单管理', path: '/admin/menus', icon: <Settings className="w-5 h-5" /> },
    { name: '角色管理', path: '/admin/roles', icon: <Award className="w-5 h-5" /> },
    { name: '用户角色', path: '/admin/user-roles', icon: <TrendingUp className="w-5 h-5" /> },
    { name: '数据分析', path: '/admin/analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { name: '系统设置', path: '/admin/settings', icon: <Settings className="w-5 h-5" /> }
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
      {/* 侧边栏 */}
      <aside style={{ display: 'none' }} className="w-64 bg-white shadow-sm">
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}`}
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
          <Route path="/tasks" element={<TaskManagementPage />} />
          <Route path="/task-create" element={<TaskCreatePage />} />
          <Route path="/task-edit/:id" element={<TaskCreatePage />} />
          <Route path="/task-detail/:id" element={<TaskCreatePage />} />
          <Route path="/analytics" element={<DataAnalyticsPage />} />
          <Route path="/grades" element={<GradeManagementPage />} />
          <Route path="/menus" element={<MenuManagementPage />} />
          <Route path="/roles" element={<RoleManagementPage />} />
          <Route path="/user-roles" element={<UserRoleManagementPage />} />
          <Route path="/settings" element={<div>系统设置页面</div>} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}