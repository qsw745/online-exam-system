// src/app/routing/DynamicRoutes.tsx
import React, { lazy, Suspense } from 'react'
import { Route } from 'react-router-dom'
import { useMenuPermissions } from '@shared/hooks/useMenuPermissions'
import type { MenuItem as CtxMenuItem } from '@shared/contexts/MenuPermissionContext'
import LoadingSpinner from '@shared/components/LoadingSpinner'

// 用上下文里的类型，避免不一致
type MenuItem = CtxMenuItem

// 页面组件映射（统一用别名路径）
const pageComponents: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Admin
  '/admin': lazy(() => import('@features/admin/pages/AdminPage')),
  '/admin/users': lazy(() => import('@features/users/pages/UserManagementPage')),
  '/admin/questions': lazy(() => import('@features/questions/pages/QuestionManagementPage')),
  '/admin/question-create': lazy(() => import('@features/questions/pages/QuestionCreatePage')),
  '/admin/papers': lazy(() => import('@features/papers/pages/PaperManagementPage')),
  '/admin/paper-create': lazy(() => import('@features/papers/pages/PaperCreatePage')),
  '/admin/tasks': lazy(() => import('@features/tasks/pages/TaskManagementPage')),
  '/admin/task-create': lazy(() => import('@features/tasks/pages/TaskCreatePage')),
  '/admin/menus': lazy(() => import('@features/menu/pages/MenuManagementPage')),
  '/admin/analytics': lazy(() => import('@features/analytics/pages/DataAnalyticsPage')),
  '/admin/grades': lazy(() => import('@features/analytics/pages/GradeManagementPage')),

  // User
  '/dashboard': lazy(() => import('@features/dashboard/pages/DashboardPage')),
  '/exams': lazy(() => import('@features/exams/pages/ExamListPage')),
  '/exam': lazy(() => import('@features/exams/pages/ExamPage')),
  '/exam/list': lazy(() => import('@features/exams/pages/ExamListPage')),
  '/practice': lazy(() => import('@features/questions/pages/QuestionPracticePage')),
  '/results': lazy(() => import('@features/exams/pages/ResultsPage')),
  '/profile': lazy(() => import('@features/profile/pages/ProfilePage')),
  '/learning-progress': lazy(() => import('@features/learning-progress/pages/LearningProgressPage')),
  '/learning/progress': lazy(() => import('@features/learning-progress/pages/LearningProgressPage')),
  '/favorites': lazy(() => import('@features/favorites/pages/FavoritesPage')),
  '/wrong-questions': lazy(() => import('@features/wrong-questions/pages/WrongQuestionsPage')),
  '/discussion': lazy(() => import('@features/discussions/pages/DiscussionPage')),
  '/leaderboard': lazy(() => import('@features/leaderboard/pages/LeaderboardPage')),
  '/logs': lazy(() => import('@features/logs/pages/LogsPage')),
  '/analytics': lazy(() => import('@features/analytics/pages/AnalyticsPage')),
  '/settings': lazy(() => import('@features/settings/pages/SettingsPage')),
  '/notifications': lazy(() => import('@features/notifications/pages/NotificationsPage')),
  '/tasks': lazy(() => import('@features/tasks/pages/TasksPage')),
  '/system/menus': lazy(() => import('@features/menu/pages/MenuManagementPage')),
}

const normalizePath = (p: string) => (p.startsWith('/') ? p.slice(1) : p)

type ProtectedRouteProps = { children: React.ReactNode; requiredPath: string }

// 轻量的权限守卫（只包一层，复用你现有 Hook）
function ProtectedRoute({ children, requiredPath }: ProtectedRouteProps) {
  const { hasMenuPermission } = useMenuPermissions()
  if (!hasMenuPermission(requiredPath)) {
    return null // 没权限就不注入该 Route
  }
  return <>{children}</>
}

export default function DynamicRoutes() {
  const { flatMenus, loading, error } = useMenuPermissions()

  // 注意：此组件会作为 <Routes> 的子元素使用，不能渲染非 <Route>。
  if (loading || error) return <></>

  // 只处理有 path 的菜单（类型收窄，解决 path?: string 带来的报错）
  const routeMenus = flatMenus.filter(
    (m): m is MenuItem & { path: string } => typeof m.path === 'string' && m.path.length > 0
  )

  return (
    <>
      {routeMenus.map(menu => {
        const Component = pageComponents[menu.path!]
        const routePath = normalizePath(menu.path!)

        if (!Component) {
          // 没有映射，就跳过（也可以在这里注一个占位 404 Route）
          return null
        }

        return (
          <Route
            key={menu.id}
            path={routePath}
            element={
              <ProtectedRoute requiredPath={menu.path!}>
                <Suspense fallback={<LoadingSpinner />}>
                  <Component />
                </Suspense>
              </ProtectedRoute>
            }
          />
        )
      })}
    </>
  )
}
