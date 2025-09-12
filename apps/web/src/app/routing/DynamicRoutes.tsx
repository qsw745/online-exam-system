// apps/web/src/app/routing/DynamicRoutes.tsx
import NotFound404 from '@/app/errors/NotFound404'
import AdminLayout from '@/app/routing/AdminLayout'
import ProtectedLayout from '@/app/routing/ProtectedLayout'
import { menuApi } from '@/shared/api/endpoints/menu'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useRoutes, type RouteObject } from 'react-router-dom'
import { componentRegistry } from './pageRegistry'

type RouteNode = {
  path?: string | null
  component?: string | null
  redirect?: string | null
  is_disabled?: boolean
  is_hidden?: boolean
  children?: RouteNode[]
}

/** 去掉开头斜杠，作为相对路径 */
const trimSlash = (p?: string | null) => (p || '').replace(/^\/+/, '')
/** 去掉 /admin/ 前缀，得到 admin 相对路径 */
const trimAdmin = (p: string) => p.replace(/^\/?admin\/?/, '')
/** 是否 admin 路由 */
const isAdminPath = (p: string) => /^\/?admin(\/|$)/.test(p)

/** 计算“相对于父级”的子路径（避免 menus/menus/functional 这种重复） */
function relativize(childRel: string, parentRel: string): string {
  if (!parentRel) return childRel
  if (childRel === parentRel) return '' // 与父相同 → 视为 index
  if (childRel.startsWith(parentRel + '/')) return childRel.slice(parentRel.length + 1)
  return childRel
}

/** 递归把后端树转为 React Router 的 RouteObject，自动做相对化 */
function toRouteObjects(nodes: RouteNode[], base: 'root' | 'admin', parentRel = ''): RouteObject[] {
  const out: RouteObject[] = []

  for (const n of nodes) {
    if (!n || n.is_disabled) continue
    const rawPath = n.path || ''
    const admin = isAdminPath(rawPath)
    if (base === 'admin' && !admin) continue
    if (base === 'root' && admin) continue

    // 当前节点自己在“该 base 下”的相对路径
    const selfRelRaw = base === 'admin' ? trimAdmin(rawPath) : trimSlash(rawPath)
    const selfRel = relativize(selfRelRaw, parentRel)

    // 目录节点（无 component）
    if (!n.component) {
      const children = n.children?.length ? toRouteObjects(n.children, base, selfRelRaw) : []
      // selfRel 为空：直接展开子节点
      if (!selfRel) out.push(...children)
      else out.push({ path: selfRel, children })
      continue
    }

    // 页面节点（有 component）
    const Cmp = componentRegistry[n.component]
    const element = Cmp ? <Cmp /> : <NotFound404 />
    const children = n.children?.length ? toRouteObjects(n.children, base, selfRelRaw) : undefined

    // selfRel 为空：做成 index；否则正常 path
    if (!selfRel) {
      out.push({ index: true, element })
    } else {
      out.push({ path: selfRel, element, children })
    }
  }

  return out
}

export default function DynamicRoutes() {
  const [tree, setTree] = useState<RouteNode[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await menuApi.routeTree() // 后端返回 [{ path, component, children }]
        if (alive) setTree(Array.isArray(data) ? data : [])
      } catch (e: any) {
        if (alive) setErr(e?.message || '加载动态路由失败')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // 统一一个 useMemo，保持 Hook 顺序稳定
  const routes: RouteObject[] = useMemo(() => {
    if (err) return [{ path: '*', element: <NotFound404 /> }]
    if (tree === null) return [{ path: '*', element: <LoadingSpinner /> }]

    const rootRoutes = toRouteObjects(tree, 'root')
    const adminRoutes = toRouteObjects(tree, 'admin')

    const defaultHome =
      rootRoutes.find(r => 'path' in r && r.path === 'dashboard')?.path ||
      rootRoutes.find(r => 'path' in r && r.path && r.path !== '*')?.path ||
      'dashboard'

    return [
      {
        path: '/',
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <Navigate to={`/${defaultHome}`} replace /> },
          ...rootRoutes,
          {
            path: 'admin',
            element: <AdminLayout />,
            children: adminRoutes.length
              ? adminRoutes
              : [{ index: true, element: <Navigate to="/admin/orgs" replace /> }],
          },
          { path: 'errors/404', element: <NotFound404 /> },
          { path: '*', element: <NotFound404 /> },
        ],
      },
      { path: '*', element: <NotFound404 /> },
    ]
  }, [tree, err])

  return useRoutes(routes)
}
