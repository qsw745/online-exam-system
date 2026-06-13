// 放到：src/shared/hooks/useRouteRefresh.ts
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ROUTE_REFRESH_EVENT = 'app:route-refresh'

export function useRouteRefresh(onRefresh: () => void) {
  const location = useLocation()
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ path: string; at: number }>
      if (ce.detail?.path === location.pathname) {
        onRefresh()
      }
    }
    window.addEventListener(ROUTE_REFRESH_EVENT, handler as EventListener)
    return () => window.removeEventListener(ROUTE_REFRESH_EVENT, handler as EventListener)
  }, [location.pathname, onRefresh])
}
