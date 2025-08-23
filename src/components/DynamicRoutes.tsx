import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useMenuPermissions, MenuItem } from '../hooks/useMenuPermissions'
import LoadingSpinner from './LoadingSpinner'

// 页面组件映射
const pageComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // 管理员页面
  '/admin': React.lazy(() => import('../pages/admin/AdminPage')),
  '/admin/users': React.lazy(() => import('../pages/admin/UserManagementPage')),
  '/admin/questions': React.lazy(() => import('../pages/admin/QuestionManagementPage')),
  '/admin/question-create': React.lazy(() => import('../pages/admin/QuestionCreatePage')),
  '/admin/papers': React.lazy(() => import('../pages/admin/PaperManagementPage')),
  '/admin/paper-create': React.lazy(() => import('../pages/admin/PaperCreatePage')),
  '/admin/tasks': React.lazy(() => import('../pages/admin/TaskManagementPage')),
  '/admin/task-create': React.lazy(() => import('../pages/admin/TaskCreatePage')),
  '/admin/menus': React.lazy(() => import('../pages/admin/MenuManagementPage')),
  '/admin/analytics': React.lazy(() => import('../pages/admin/DataAnalyticsPage')),
  '/admin/grades': React.lazy(() => import('../pages/admin/GradeManagementPage')),
  
  // 用户页面
  '/dashboard': React.lazy(() => import('../pages/DashboardPage')),
  '/exams': React.lazy(() => import('../pages/ExamListPage')),
  '/exam': React.lazy(() => import('../pages/ExamPage')),
  '/exam/list': React.lazy(() => import('../pages/ExamListPage')),
  '/practice': React.lazy(() => import('../pages/QuestionPracticePage')),
  '/results': React.lazy(() => import('../pages/ResultsPage')),
  '/profile': React.lazy(() => import('../pages/ProfilePage')),
  '/learning-progress': React.lazy(() => import('../pages/LearningProgressPage')),
  '/learning/progress': React.lazy(() => import('../pages/LearningProgressPage')),
  '/favorites': React.lazy(() => import('../pages/FavoritesPage')),
  '/wrong-questions': React.lazy(() => import('../pages/WrongQuestionsPage')),
  '/discussion': React.lazy(() => import('../pages/DiscussionPage')),
  '/leaderboard': React.lazy(() => import('../pages/LeaderboardPage')),
  '/logs': React.lazy(() => import('../pages/LogsPage')),
  '/analytics': React.lazy(() => import('../pages/AnalyticsPage')),
  '/settings': React.lazy(() => import('../pages/SettingsPage')),
  '/notifications': React.lazy(() => import('../pages/NotificationsPage')),
  '/tasks': React.lazy(() => import('../pages/TasksPage')),
  '/system/menus': React.lazy(() => import('../pages/admin/MenuManagementPage')),
}

// 路由权限守卫组件
interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPath: string
}

function ProtectedRoute({ children, requiredPath }: ProtectedRouteProps) {
  const { hasMenuPermission, loading } = useMenuPermissions()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!hasMenuPermission(requiredPath)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">访问被拒绝</h2>
          <p className="text-gray-600">您没有访问此页面的权限</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// 动态路由生成器
interface DynamicRoutesProps {
  basePath?: string
}

export default function DynamicRoutes({ basePath = '' }: DynamicRoutesProps) {
  const { flatMenus, loading, error } = useMenuPermissions()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">加载失败</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // 生成动态路由
  const generateRoutes = (menus: MenuItem[]) => {
    return menus.map((menu) => {
      const fullPath = basePath + menu.path
      const Component = pageComponents[menu.path]

      if (!Component) {
        // 如果没有对应的组件，返回404页面
        return (
          <Route
            key={menu.id}
            path={menu.path.replace(basePath, '')}
            element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">页面未找到</h2>
                  <p className="text-gray-600">该页面正在开发中</p>
                </div>
              </div>
            }
          />
        )
      }

      return (
        <Route
          key={menu.id}
          path={menu.path.replace(basePath, '')}
          element={
            <ProtectedRoute requiredPath={menu.path}>
              <React.Suspense fallback={<LoadingSpinner />}>
                <Component />
              </React.Suspense>
            </ProtectedRoute>
          }
        />
      )
    })
  }

  return (
    <Routes>
      {generateRoutes(flatMenus)}
      {/* 默认重定向 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// 菜单驱动的导航组件
interface MenuNavigationProps {
  className?: string
  onMenuClick?: (menu: MenuItem) => void
}

export function MenuNavigation({ className, onMenuClick }: MenuNavigationProps) {
  const { menus, loading } = useMenuPermissions()

  if (loading) {
    return <div className={className}>加载中...</div>
  }

  const renderMenuItem = (menu: MenuItem, level = 0) => {
    const hasChildren = menu.children && menu.children.length > 0
    
    return (
      <div key={menu.id} className={`menu-item level-${level}`}>
        <div
          className="menu-item-content"
          onClick={() => onMenuClick?.(menu)}
        >
          {menu.icon && <span className="menu-icon">{menu.icon}</span>}
          <span className="menu-name">{menu.name}</span>
        </div>
        {hasChildren && (
          <div className="menu-children">
            {menu.children!.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className={className}>
      {menus.map(menu => renderMenuItem(menu))}
    </nav>
  )
}

// 面包屑导航组件
export function BreadcrumbNavigation() {
  const { flatMenus } = useMenuPermissions()
  const currentPath = window.location.pathname

  // 根据当前路径查找菜单项
  const findMenuByPath = (path: string): MenuItem | null => {
    return flatMenus.find(menu => menu.path === path) || null
  }

  // 构建面包屑路径
  const buildBreadcrumb = (): MenuItem[] => {
    const breadcrumb: MenuItem[] = []
    const currentMenu = findMenuByPath(currentPath)
    
    if (currentMenu) {
      breadcrumb.push(currentMenu)
      
      // 查找父级菜单
      let parentId = currentMenu.parent_id
      while (parentId) {
        const parentMenu = flatMenus.find(menu => menu.id === parentId)
        if (parentMenu) {
          breadcrumb.unshift(parentMenu)
          parentId = parentMenu.parent_id
        } else {
          break
        }
      }
    }
    
    return breadcrumb
  }

  const breadcrumb = buildBreadcrumb()

  if (breadcrumb.length === 0) {
    return null
  }

  return (
    <nav className="breadcrumb">
      {breadcrumb.map((menu, index) => (
        <span key={menu.id} className="breadcrumb-item">
          {index > 0 && <span className="breadcrumb-separator">/</span>}
          <span className="breadcrumb-text">{menu.name}</span>
        </span>
      ))}
    </nav>
  )
}