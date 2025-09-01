import { useQuery } from '@tanstack/react-query'
import React, { Suspense, useMemo } from 'react'
import { Navigate, Route } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import { api } from '../lib/api'
import { ComponentRegistry } from './componentRegistry'

type MenuNode = {
  id: number
  path?: string
  component?: string
  redirect?: string
  children?: MenuNode[]
  is_disabled?: boolean
  is_hidden?: boolean
}

async function fetchRouteTree(): Promise<MenuNode[]> {
  const res = await api.get<MenuNode[]>('/menu/route-tree')
  if (!res.success) {
    const msg = 'error' in res ? res.error : '获取菜单路由失败'
    throw new Error(msg)
  }
  const payload: any = res.data
  return Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? payload?.list ?? []
}

/** 返回一组 <Route/> 节点，供 <Routes> 直接插入使用 */
export function useDynamicMenuRoutes(): React.ReactElement[] {
  const { data } = useQuery({
    queryKey: ['menu-route-tree'],
    queryFn: fetchRouteTree,
    staleTime: 5 * 60 * 1000,
  })

  const routes = useMemo<React.ReactElement[]>(() => {
    if (!data?.length) return []
    const els: React.ReactElement[] = []

    const dfs = (list: MenuNode[]) => {
      list.forEach(n => {
        if (n.is_disabled) return
        const Comp = n.component ? ComponentRegistry[n.component] : undefined

        if (n.redirect && n.path) {
          els.push(<Route key={`redir-${n.id}`} path={n.path} element={<Navigate to={n.redirect} replace />} />)
          return
        }

        if (Comp && n.path) {
          els.push(
            <Route
              key={n.id}
              path={n.path}
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <Comp />
                </Suspense>
              }
            />
          )
        }

        if (n.children?.length) dfs(n.children)
      })
    }

    dfs(data)
    return els
  }, [data])

  return routes
}
