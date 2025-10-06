// src/app/routing/DynamicRoutes.tsx
import NotFound404 from '@/app/errors/NotFound404'
import AdminLayout from '@/app/routing/AdminLayout'
import ProtectedLayout from '@/app/routing/ProtectedLayout'
import { menuApi } from '@/shared/api/endpoints/menu'
import AppLayout from '@/shared/components/Layout'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useAuth } from '@/shared/contexts/AuthContext'
import TabsShell from '@/shared/router/TabsShell'
import React, { Suspense, useEffect, useMemo, useState } from 'react'
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

/* -------------------- 路径工具 -------------------- */
const collapseSlashes = (p: string) => p.replace(/\/{2,}/g, '/')
/** 绝对路径拼接 */
function joinAbs(parentAbs: string, childPath: string | null | undefined): string {
  const raw = (childPath || '').trim()
  if (!raw) return parentAbs || '/'
  if (raw.startsWith('/')) return collapseSlashes(raw)
  const base = parentAbs && parentAbs !== '/' ? parentAbs : ''
  return collapseSlashes(`${base}/${raw}`)
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

/** 末尾 index 规范化（支持 xxx-index 或 xxx/index） */
const stripIndexSuffix = (p: string) => p.replace(/(?:\/index|-index)(?=\/?$)/, '')

/** 把 rel 路径规范化；若是带 index 的路径，返回 clean 与 alias */
function normalizeRel(rel: string) {
  const clean = stripIndexSuffix(rel)
  const hasAlias = clean !== rel
  return { clean, alias: hasAlias ? rel : null }
}

const fallbackText: Record<string, string> = {
  dashboard: '加载仪表盘数据…',
  tasks: '加载我的任务…',
  'exam-list': '加载考试列表…',
}

/** 从注册表安全拿组件并构造成元素 */
function elementFromRegistry(key: string) {
  const Cmp = componentRegistry[key] as React.ComponentType<any> | undefined
  const tip = fallbackText[key] ?? '页面加载中…'
  return Cmp ? (
    <Suspense fallback={<LoadingSpinner center="page" text={tip} />}>
      <Cmp />
    </Suspense>
  ) : (
    <NotFound404 />
  )
}

/** 为目录节点生成 index 重定向（遵从并规范后端 redirect） */
function makeIndexRedirect(n: RouteNode, base: '/' | '/admin'): RouteObject | null {
  const raw = (n.redirect || '').trim()
  if (!raw) return null
  const to = stripIndexSuffix(collapseSlashes(raw)) // <-- 规范化 redirect
  const inAdmin = isAdminAbs(to)
  if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) return null
  return { index: true, element: <Navigate to={to} replace /> }
}

/* -------------------- 从菜单构建路由（不限层级） -------------------- */
function buildRoutes(nodes: RouteNode[], base: '/' | '/admin', parentAbs = '', parentRel = ''): RouteObject[] {
  const out: RouteObject[] = []

  for (const n of nodes || []) {
    if (!n || n.is_disabled) continue

    const abs = joinAbs(parentAbs, n.path)
    const inAdmin = isAdminAbs(abs)

    // 只收集当前命名空间（学员端 / 后台）
    if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) {
      if (n.children?.length) out.push(...buildRoutes(n.children, base, abs, ''))
      continue
    }

    const relRaw = absToRel(abs, base)
    const rel = relativize(relRaw, parentRel)

    // 目录节点（无 component）
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

    // 页面节点（有 component）
    const element = elementFromRegistry(n.component!)
    const nestedChildren = n.children?.length ? buildRoutes(n.children, base, abs, relRaw) : undefined

    // 规范化页面路径，处理 *-index / */index
    const { clean, alias } = normalizeRel(rel)

    // 主路由：用“干净路径”
    // ✅ index 路由不能带 children
    if (!clean) {
      out.push({ index: true, element }) // 只保留 element
      if (nestedChildren?.length) out.push(...nestedChildren) // 子路由平铺
    } else {
      out.push({ path: clean, element, children: nestedChildren })
    }

    // 别名：旧地址重定向到干净地址，避免 404（比如 /dashboard-index -> /dashboard）
    if (alias) {
      const destAbs = stripIndexSuffix(abs) || (base === '/admin' ? '/admin' : '/')
      out.push({ path: alias, element: <Navigate to={destAbs} replace /> })
    }
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
      const cached = (menuApi as any).getRouteTreeCached?.()
      if (cached) {
        setTree(cached as RouteNode[])
        setErr(null)
      } else {
        ;(async () => {
          try {
            const data = await menuApi.functionsTree()
            if (alive) {
              setTree(Array.isArray(data) ? (data as RouteNode[]) : [])
              setErr(null)
            }
          } catch (e: any) {
            if (alive) {
              setErr(e?.message || '加载动态路由失败')
              setTree([])
            }
          }
        })()
      }
    } else {
      setTree(null)
      setErr(null)
    }
    return () => {
      alive = false
    }
  }, [authLoading, user])

  const routes: RouteObject[] = useMemo(() => {
    // 必须包含 index 路由，否则访问 "/" 时会命中空路径导致空白
    if (authLoading) {
      return [
        { index: true, element: <LoadingSpinner center="page" text="加载中…" /> },
        { path: '*', element: <LoadingSpinner center="page" text="加载中…" /> },
      ]
    }

    if (!user) {
      return [
        {
          element: <ProtectedLayout />,
          children: [
            { index: true, element: <Navigate to="/login" replace /> },
            { path: '*', element: <Navigate to="/login" replace /> },
          ],
        },
      ]
    }

    if (err) {
      return [
        { index: true, element: <NotFound404 /> },
        { path: '*', element: <NotFound404 /> },
      ]
    }

    if (tree === null) {
      return [
        { index: true, element: <LoadingSpinner center="page" text="加载中…" /> },
        { path: '*', element: <LoadingSpinner center="page" text="加载中…" /> },
      ]
    }

    const rootRoutes = buildRoutes(tree, '/')
    const adminRoutes = buildRoutes(tree, '/admin')

    const extraFixedRoutes: RouteObject[] = [
      { path: 'exam/:id', element: elementFromRegistry('exam') },
      { path: 'exam/task/:taskId', element: elementFromRegistry('exam') },
      { path: 'results/:id', element: elementFromRegistry('result-detail') },
      { path: 'questions/:id/practice', element: elementFromRegistry('question-practice') },
      { path: 'questions/:id', element: elementFromRegistry('question-practice') },
      { path: 'learning/practice/:id', element: elementFromRegistry('question-practice') },
      { path: 'settings', element: elementFromRegistry('settings') },
      { path: 'tasks/detail/:id', element: elementFromRegistry('task-detail') },
    ]

    const extraAdminRoutes: RouteObject[] = [
      { path: 'question-detail/:id', element: elementFromRegistry('question-detail') },
      { path: 'question-edit/:id', element: elementFromRegistry('question-edit') },
      { path: 'tasks/detail/:id', element: elementFromRegistry('task-detail') },
      { path: 'paper-detail/:id', element: elementFromRegistry('paper-detail') },
      { path: 'paper-edit/:id', element: elementFromRegistry('paper-edit') },
      { path: 'tasks/edit/:id', element: elementFromRegistry('tasks-edit') },
    ]

    // 选择一个默认首页（优先 dashboard）
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
                element: <TabsShell />,
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
