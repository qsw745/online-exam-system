import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ROUTE_REFRESH_EVENT } from '@/shared/utils/route-refresh'

/** 监听全局刷新事件，给 Outlet 换 key 来强制 remount 当前页 */
export default function RefreshableOutlet() {
  const location = useLocation()
  const [bump, setBump] = React.useState(0)

  React.useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{ path: string; at: number }>
      if (detail?.path === location.pathname) setBump(x => x + 1)
    }
    window.addEventListener(ROUTE_REFRESH_EVENT, handler as EventListener)
    return () => window.removeEventListener(ROUTE_REFRESH_EVENT, handler as EventListener)
  }, [location.pathname])

  return <Outlet key={`${location.pathname}::${bump}`} />
}
