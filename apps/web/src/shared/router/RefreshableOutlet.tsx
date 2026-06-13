import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ROUTE_REFRESH_EVENT } from '@/shared/utils/route-refresh'

function normalizePath(p: string) {
  // 忽略多余斜杠与尾部斜杠，但保留根路径 '/'
  if (!p) return '/'
  let x = p.split('#')[0]!.split('?')[0] || '/'
  if (x.length > 1 && x.endsWith('/')) x = x.replace(/\/+$/, '')
  return x.replace(/\/{2,}/g, '/')
}

/** 监听全局刷新事件 & location.state.__bump，给 Outlet 换 key 来强制 remount 当前页 */
export default function RefreshableOutlet() {
  const location = useLocation()
  const [bump, setBump] = React.useState(0)
  const path = normalizePath(location.pathname)
  const bumpToken = (location.state as any)?.__bump

  React.useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent<{ path: string; at: number }>
      if (!detail?.path) return
      const target = normalizePath(detail.path)
      if (target === path) setBump(x => x + 1)
    }
    window.addEventListener(ROUTE_REFRESH_EVENT, handler as EventListener)
    return () => window.removeEventListener(ROUTE_REFRESH_EVENT, handler as EventListener)
  }, [path])

  // ✅ 同一路由“替换导航”时，利用 state.__bump 也触发 remount
  React.useEffect(() => {
    if (bumpToken) setBump(x => x + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpToken])

  return <Outlet key={`${path}::${bump}`} />
}
