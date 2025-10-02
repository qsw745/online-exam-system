import { Outlet } from 'react-router-dom'
import AppProviders from '@/AppProviders'

/** 路由根：把 AppProviders（含 LayoutProvider）放到 Router 内部 */
export default function RouterRoot() {
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  )
}
