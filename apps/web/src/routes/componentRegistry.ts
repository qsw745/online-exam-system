// src/routes/componentRegistry.ts
import { lazy, type ComponentType } from 'react'
import AnalyticsPage from '../pages/AnalyticsPage'
import DashboardPage from '../pages/DashboardPage'
import OrgManage from '../pages/admin/OrgManage'
import RoleManagementPage from '../pages/admin/RoleManagementPage'
import NotFound404 from '../pages/errors/NotFound404'

// 懒加载错误页

const Error403 = lazy(() => import('../pages/errors/Forbidden403')) // 'errors-403'
const Error404 = lazy(() => import('../pages/errors/NotFound404')) // 'errors-404'
const Error500 = lazy(() => import('../pages/errors/ServerError500')) // 'errors-500'

export const ComponentRegistry: Record<string, ComponentType<any>> = {
  dashboard: DashboardPage,
  analytics: AnalyticsPage,
  'admin-org': OrgManage,
  'admin-role': RoleManagementPage,

  'errors-403': Error403,
  'errors-404': Error404,
  'errors-500': Error500,
  __404__: NotFound404,
}
