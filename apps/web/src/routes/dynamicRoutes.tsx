// src/routes/dynamicRoutes.tsx
import { useQuery } from '@tanstack/react-query'
import React, { Suspense, useMemo } from 'react'
import { Navigate, Route } from 'react-router-dom' // ✅ 补充 Navigate
import LoadingSpinner from '../components/LoadingSpinner'
import { ComponentRegistry } from './componentRegistry'

// 菜单路由结构（与后端 route-tree 返回一致）
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
  const res = await fetch('/api/menu/route-tree', { credentials: 'include' })
  if (!res.ok) throw new Error('获取菜单路由失败')
  const data = await res.json()
  // 兼容 { success, data } 或直接数组
  return Array.isArray(data) ? data : data.data ?? []
}

// 把菜单数组转成 <Route/> 列表
function renderRoutes(nodes: MenuNode[]): React.ReactNode[] {
  const routes: React.ReactNode[] = []

  const dfs = (list: MenuNode[]) => {
    list.forEach(n => {
      if (n.is_disabled) return
      const Comp = n.component ? ComponentRegistry[n.component] : undefined

      // 1) 重定向
      if (n.redirect && n.path) {
        routes.push(<Route key={`r-${n.id}`} path={n.path} element={<Navigate to={n.redirect} replace />} />)
        return
      }

      // 2) 有组件 & 有路径
      if (Comp && n.path) {
        routes.push(
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

      // 3) 子节点（父节点可无 component，仅做分组）
      if (n.children?.length) dfs(n.children)
    })
  }

  dfs(nodes)
  return routes
}

export default function DynamicRoutes() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['menu-route-tree'],
    queryFn: fetchRouteTree,
    staleTime: 5 * 60 * 1000,
  })

  const routeElements = useMemo(() => renderRoutes(data ?? []), [data])

  if (isLoading) return null
  if (error) return null

  return <>{routeElements}</>
}
