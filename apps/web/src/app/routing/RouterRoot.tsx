import { Outlet } from 'react-router-dom'
import RouteProgress from '@/shared/components/RouteProgress'

/** 路由根：只挂路由级能力，全局 Provider 在 App.tsx 根部统一包裹 */
export default function RouterRoot() {
    return (
      <>
        <RouteProgress /> {/* ✅ 顶部只挂一次 */}
        <Outlet />
      </>
    )
}
