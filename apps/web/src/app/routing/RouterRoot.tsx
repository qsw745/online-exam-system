import { Outlet } from 'react-router-dom'
import AppProviders from '@/AppProviders'
import RouteProgress from '@/shared/components/RouteProgress'

/** 路由根：把 AppProviders（含 LayoutProvider）放到 Router 内部 */
export default function RouterRoot() {
    return (
      <>
        <RouteProgress /> {/* ✅ 顶部只挂一次 */}
        <AppProviders>
          <Outlet />
        </AppProviders>
      </>
    )
}
