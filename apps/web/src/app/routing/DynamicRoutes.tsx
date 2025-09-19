import NotFound404 from '@/app/errors/NotFound404'
import AdminLayout from '@/app/routing/AdminLayout'
import ProtectedLayout from '@/app/routing/ProtectedLayout'
import { menuApi } from '@/shared/api/endpoints/menu'
import AppLayout from '@/shared/components/Layout'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useAuth } from '@/shared/contexts/AuthContext'
import RefreshableOutlet from '@/shared/router/RefreshableOutlet'
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
const fallbackText: Record<string, string> = {
  dashboard: '加载仪表盘数据…',
  tasks: '加载我的任务…',
  'exam-list': '加载考试列表…',
}
/** 安全取组件（带 Suspense） */
function elementFromRegistry(key: string) {
  const Cmp = componentRegistry[key]
  const tip = fallbackText[key] ?? '页面加载中…'
  return Cmp ? (
    <Suspense fallback={<LoadingSpinner center="page" text={tip} />}>
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

    if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) {
      if (n.children?.length) out.push(...buildRoutes(n.children, base, abs, ''))
      continue
    }

    const relRaw = absToRel(abs, base)
    const rel = relativize(relRaw, parentRel)

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

    const element = elementFromRegistry(n.component!)
    const nestedChildren = n.children?.length ? buildRoutes(n.children, base, abs, relRaw) : undefined

    if (!rel) out.push({ index: true, element })
    else out.push({ path: rel, element, children: nestedChildren })
  }

  return out
}

export default function DynamicRoutes() {
  const { user, loading: authLoading } = useAuth()
  const [tree, setTree] = useState<RouteNode[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!authLoading && user) {
      const cached = menuApi.getRouteTreeCached?.()
      if (cached) {
        setTree(cached as any)
        setErr(null)
        return
      }
      ;(async () => {
        try {
          const data = await menuApi.routeTree()
          if (alive) {
            setTree(Array.isArray(data) ? data : [])
            setErr(null)
          }
        } catch (e: any) {
          if (alive) {
            setErr(e?.message || '加载动态路由失败')
            setTree([])
          }
        }
      })()
    } else {
      setTree(null)
      setErr(null)
    }
    return () => {
      alive = false
    }
  }, [authLoading, user])

  const routes: RouteObject[] = useMemo(() => {
    if (authLoading) return [{ path: '*', element: <LoadingSpinner center="page" text="加载中…" /> }]

    if (!user) {
      return [{ element: <ProtectedLayout />, children: [{ path: '*', element: <Navigate to="/login" replace /> }] }]
    }

    if (err) return [{ path: '*', element: <NotFound404 /> }]
    if (tree === null) return [{ path: '*', element: <LoadingSpinner center="page" text="加载中…" /> }]

    const rootRoutes = buildRoutes(tree, '/')
    const adminRoutes = buildRoutes(tree, '/admin')

    const extraFixedRoutes: RouteObject[] = [
      { path: 'exam/:id', element: elementFromRegistry('exam') },
      { path: 'results/:id', element: elementFromRegistry('results') },
      { path: 'questions/:id/practice', element: elementFromRegistry('question-practice') },
      { path: 'questions/:id', element: elementFromRegistry('question-practice') },
      { path: 'learning/practice/:id', element: elementFromRegistry('question-practice') },
      { path: 'settings', element: elementFromRegistry('settings') },
      // 学员端任务详情直达
      { path: 'tasks/detail/:id', element: elementFromRegistry('task-detail') },
    ]

    const extraAdminRoutes: RouteObject[] = [
      { path: 'question-detail/:id', element: elementFromRegistry('question-detail') },
      { path: 'question-edit/:id', element: elementFromRegistry('question-edit') },
      // 后台任务详情
      { path: 'tasks/detail/:id', element: elementFromRegistry('task-detail') },
      // ✅ 后台试卷详情/编辑直达
      { path: 'paper-detail/:id', element: elementFromRegistry('paper-detail') },
      { path: 'paper-edit/:id', element: elementFromRegistry('paper-edit') },
      { path: '/admin/tasks/edit/:id', element: elementFromRegistry('tasks-edit') },
    ]

    const defaultHome =
      (rootRoutes.find(r => 'path' in r && (r as any).path === 'dashboard') as any)?.path ||
      (rootRoutes.find(r => 'path' in r && (r as any).path && (r as any).path !== '*') as any)?.path ||
      'dashboard'

    return [
      {
        element: <ProtectedLayout />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <Navigate to={`/${defaultHome}`} replace /> },
              {
                element: <RefreshableOutlet />,
                children: [
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
            ],
          },
        ],
      },
    ]
  }, [tree, err, authLoading, user])

  return useRoutes(routes)
}
