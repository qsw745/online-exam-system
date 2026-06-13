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
import { resolveComponent } from './pageRegistry'
import type { MenuSeed } from './menuSchema'

type RouteNode = Pick<
  MenuSeed,
  'path' | 'component' | 'redirect' | 'is_disabled' | 'is_hidden' | 'children' | 'menu_type' | 'meta'
>

/* -------------------- 路径工具 -------------------- */
const collapseSlashes = (p: string) => p.replace(/\/{2,}/g, '/')
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

/** 从注册表或动态路径安全拿组件并构造成元素 */
function elementFromRegistry(key: string) {
  const Cmp = resolveComponent(key)
  const tip = fallbackText[key] ?? '页面加载中…'
  return Cmp ? (
    <Suspense fallback={<LoadingSpinner center="page" text={tip} />}>
      <Cmp />
    </Suspense>
  ) : (
    <NotFound404 />
  )
}

/** 外链占位：进入该路由立即打开 externalUrl，然后回到首页/上一页 */
type ExternalLinkProps = { url?: string | null; target?: '_blank' | '_self' | '_parent' | '_top' }
function ExternalLinkJump({ url, target = '_blank' }: ExternalLinkProps) {
  useEffect(() => {
    if (url) window.open(url, target)
  }, [url, target])
  return <Navigate to="/" replace />
}

/** iframe 容器 */
function IframeHost({ src, title }: { src: string; title?: string }) {
  return (
    <div style={{ height: '100%', display: 'grid' }}>
      <iframe src={src} title={title || 'Embedded'} style={{ width: '100%', height: '100%', border: 0 }} />
    </div>
  )
}

/** 目录节点 index 重定向 */
function makeIndexRedirect(n: RouteNode, base: '/' | '/admin'): RouteObject | null {
  const raw = (n.redirect || '').trim()
  if (!raw) return null
  const to = stripIndexSuffix(collapseSlashes(raw))
  const inAdmin = isAdminAbs(to)
  if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) return null
  return { index: true, element: <Navigate to={to} replace /> }
}

/* -------------------- 从菜单构建路由（不限层级） -------------------- */
function buildRoutes(nodes: RouteNode[], base: '/' | '/admin', parentAbs = '', parentRel = ''): RouteObject[] {
  const out: RouteObject[] = []

  for (const n of nodes || []) {
    if (!n || (n as any).is_disabled) continue

    const abs = joinAbs(parentAbs, n.path)
    const inAdmin = isAdminAbs(abs)
    if ((base === '/' && inAdmin) || (base === '/admin' && !inAdmin)) {
      if (n.children?.length) out.push(...buildRoutes(n.children as any, base, abs, ''))
      continue
    }

    const relRaw = absToRel(abs, base)
    const rel = relativize(relRaw, parentRel)

    // 目录
    if (!n.component && (n.menu_type === 'menu' || n.children?.length)) {
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

    // 外链
    if (n.menu_type === 'link' && n.meta?.externalUrl) {
      const { clean, alias } = normalizeRel(rel)
      const el = <ExternalLinkJump url={n.meta.externalUrl!} target={(n.meta.linkTarget || '_blank') as any} />
      if (!clean) out.push({ index: true, element: el })
      else out.push({ path: clean, element: el })
      if (alias) out.push({ path: alias, element: <Navigate to={clean || '/'} replace /> })
      continue
    }

    // iframe
    if (n.menu_type === 'iframe' && n.meta?.iframeSrc) {
      const { clean, alias } = normalizeRel(rel)
      const el = <IframeHost src={n.meta.iframeSrc!} title={n.meta?.i18nKey || ''} />
      if (!clean) out.push({ index: true, element: el })
      else out.push({ path: clean, element: el })
      if (alias) out.push({ path: alias, element: <Navigate to={clean || '/'} replace /> })
      continue
    }

    // 页面
    if (n.component) {
      const element = elementFromRegistry(n.component)
      const nestedChildren = n.children?.length ? buildRoutes(n.children as any, base, abs, relRaw) : undefined
      const { clean, alias } = normalizeRel(rel)

      if (!clean) {
        out.push({ index: true, element })
        if (nestedChildren?.length) out.push(...nestedChildren)
      } else {
        out.push({ path: clean, element, children: nestedChildren })
      }
      if (alias) {
        const destAbs = stripIndexSuffix(abs) || (base === '/admin' ? '/admin' : '/')
        out.push({ path: alias, element: <Navigate to={destAbs} replace /> })
      }
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
      { path: 'exam-reviews', element: elementFromRegistry('exam-reviews') },
    ]

    // 默认首页（优先 dashboard）
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
