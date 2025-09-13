import NotFound404 from '@/app/errors/NotFound404'
import AdminLayout from '@/app/routing/AdminLayout'
import ProtectedLayout from '@/app/routing/ProtectedLayout'
import { menuApi } from '@/shared/api/endpoints/menu'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { Suspense, useEffect, useMemo, useState } from 'react'
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

/** 拼出绝对路径 */
function joinAbs(parentAbs: string, childPath: string | null | undefined): string {
  const raw = (childPath || '').trim()
  if (!raw) return parentAbs || '/'
  if (raw.startsWith('/')) return raw.replace(/\/{2,}/g, '/')
  const base = parentAbs && parentAbs !== '/' ? parentAbs : ''
  return `${base}/${raw}`.replace(/\/{2,}/g, '/')
}
const isAdminAbs = (abs: string) => abs === '/admin' || abs.startsWith('/admin/')
function absToRel(abs: string, base: '/admin' | '/'): string {
  if (base === '/admin') return abs.replace(/^\/?admin/, '').replace(/^\/+/, '')
  return abs.replace(/^\/+/, '')
}
function relativize(childRel: string, parentRel: string): string {
  if (!parentRel) return childRel
  if (childRel === parentRel) return ''
  return childRel.startsWith(parentRel + '/') ? childRel.slice(parentRel.length + 1) : childRel
}

/** 安全取组件（带 Suspense） */
function elementFromRegistry(key: string) {
  const Cmp = componentRegistry[key]
  return Cmp ? (
    <Suspense fallback={<LoadingSpinner />}>
      <Cmp />
    </Suspense>
  ) : (
    <NotFound404 />
  )
}

/** 为目录节点生成 index 重定向（遵从后端 redirect） */
function makeIndexRedirect(n: RouteNode, base: '/' | '/admin'): RouteObject | null {
  const to = (n.redirect || '').trim()
  if (!to) return null
  const inAdmin = isAdminAbs(to)
  if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) return null
  return { index: true, element: <Navigate to={to} replace /> }
}

/** 从菜单构建路由 */
function buildRoutes(nodes: RouteNode[], base: '/' | '/admin', parentAbs = '', parentRel = ''): RouteObject[] {
  const out: RouteObject[] = []

  for (const n of nodes || []) {
    if (!n || n.is_disabled) continue

    const abs = joinAbs(parentAbs, n.path)
    const inAdmin = isAdminAbs(abs)

    // 根区只收非 /admin；admin 区只收 /admin
    if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) {
      if (n.children?.length) out.push(...buildRoutes(n.children, base, abs, ''))
      continue
    }

    const relRaw = absToRel(abs, base)
    const rel = relativize(relRaw, parentRel)

    // 目录节点
    if (!n.component) {
      const nested: RouteNode[] = []
      const floating: RouteNode[] = []
      for (const c of n.children || []) {
        const childAbs = joinAbs(abs, c.path)
        if (childAbs === abs || childAbs.startsWith(abs + '/')) nested.push(c)
        else floating.push(c)
      }
      const childrenNested = nested.length ? buildRoutes(nested, base, abs, relRaw) : []
      const idxRedirect = makeIndexRedirect(n, base)
      if (idxRedirect) childrenNested.unshift(idxRedirect)

      if (!rel) out.push(...childrenNested)
      else out.push({ path: rel, children: childrenNested })

      if (floating.length) out.push(...buildRoutes(floating, base, '', ''))
      continue
    }

    // 页面节点
    const element = elementFromRegistry(n.component!)
    const nestedChildren = n.children?.length ? buildRoutes(n.children, base, abs, relRaw) : undefined

    if (!rel) out.push({ index: true, element })
    else out.push({ path: rel, element, children: nestedChildren })
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
        const data = await menuApi.routeTree()
        if (alive) setTree(Array.isArray(data) ? data : [])
      } catch (e: any) {
        if (alive) setErr(e?.message || '加载动态路由失败')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const routes: RouteObject[] = useMemo(() => {
    if (err) return [{ path: '*', element: <NotFound404 /> }]
    if (tree === null) return [{ path: '*', element: <LoadingSpinner /> }]

    const rootRoutes = buildRoutes(tree, '/')
    const adminRoutes = buildRoutes(tree, '/admin')

    // 根区“固定动态路由”（不进菜单）
    const extraFixedRoutes: RouteObject[] = [
      { path: 'exam/:id', element: elementFromRegistry('exam') },
      { path: 'results/:id', element: elementFromRegistry('results') },
      { path: 'questions/:id/practice', element: elementFromRegistry('question-practice') },
      { path: 'learning/practice/:id', element: elementFromRegistry('question-practice') }, // 新增别名
      { path: 'settings', element: elementFromRegistry('settings') },
    ]

    // Admin“固定动态路由”（不进菜单；确保使用 AdminLayout）
    const extraAdminRoutes: RouteObject[] = [
      { path: 'question-detail/:id', element: elementFromRegistry('question-detail') },
      { path: 'question-edit/:id', element: elementFromRegistry('question-edit') },
      { path: 'task/detail/:id', element: elementFromRegistry('task-create') }, // ← 从根移入到 admin 下
    ]

    const defaultHome =
      rootRoutes.find(r => 'path' in r && r.path === 'dashboard')?.path ||
      rootRoutes.find(r => 'path' in r && r.path && r.path !== '*')?.path ||
      'dashboard'

    return [
      {
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <Navigate to={`/${defaultHome}`} replace /> },
          ...rootRoutes,
          ...extraFixedRoutes,
          {
            path: 'admin',
            element: <AdminLayout />,
            children: adminRoutes.length
              ? [...adminRoutes, ...extraAdminRoutes]
              : [...extraAdminRoutes, { index: true, element: <Navigate to="/admin/orgs" replace /> }],
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
