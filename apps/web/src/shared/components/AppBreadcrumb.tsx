// src/shared/components/AppBreadcrumb.tsx
import { useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'
import { Breadcrumb } from 'antd'
import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// 与 Tabs 保持一致：'/' 与 '/dashboard' 视为同一路由（只用于匹配，不再强插面包屑）
const DASHBOARD_CANON = '/dashboard'
const DASHBOARD_ALIASES = new Set<string>(['/', '/dashboard'])
const normalizePath = (p?: string) => (p && DASHBOARD_ALIASES.has(p) ? DASHBOARD_CANON : p || '/')

type CrumbItem = { title: React.ReactNode; href?: string }

type Props = {
  /** 传入则完全使用自定义面包屑（默认自动生成） */
  items?: CrumbItem[]
  /** 是否隐藏 URL 里的 id/uuid/数字参数段，默认 true */
  hideParams?: boolean
  /** 末尾是否可点击（默认 false：最后一项不带 href） */
  lastClickable?: boolean
  /** 额外的右侧内容（例如操作按钮区域），可选 */
  extra?: React.ReactNode
  /** 包装容器样式，可选 */
  style?: React.CSSProperties
  className?: string
}

export default function AppBreadcrumb({
  items,
  hideParams = true,
  lastClickable = false,
  extra,
  style,
  className,
}: Props) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { menus } = useMenuPermissions()

  const autoItems: CrumbItem[] = React.useMemo(() => {
    if (items && items.length) return items

    const path = normalizePath(pathname)

    // 1) 菜单树中找“最长前缀匹配”的祖先链
    type MenuItem = { id: number; title: string; path?: string; is_hidden?: boolean; children?: MenuItem[] }
    const trail: MenuItem[] = []
    let bestTrail: MenuItem[] = []
    const hasDyn = (p?: string) => !!p && /[:[\{]/.test(p || '')

    const dfs = (nodes: MenuItem[]) => {
      for (const m of nodes) {
        if (m.is_hidden) continue
        const p = m.path && !hasDyn(m.path) ? normalizePath(m.path) : undefined
        trail.push(m)
        if (p && (path === p || path.startsWith(p + '/'))) {
          if (trail.length > bestTrail.length) bestTrail = [...trail]
        }
        if (m.children?.length) dfs(m.children)
        trail.pop()
      }
    }
    dfs(menus as any)

    // 2) 把 bestTrail 转为面包屑；不再强制插入“仪表盘”
    const result: CrumbItem[] = []
    const seen = new Set<string>()
    for (let i = 0; i < bestTrail.length; i++) {
      const m = bestTrail[i]
      const p = m.path ? normalizePath(m.path) : undefined
      const isLast = i === bestTrail.length - 1
      const href = p && (!isLast || lastClickable) ? p : undefined
      if (p && seen.has(p)) continue
      if (p) seen.add(p)
      result.push({ title: m.title, href })
    }

    // 3) 如果菜单没有匹配（如非菜单路由），用 URL 段兜底；同样不插“仪表盘”
    if (result.length === 0) {
      const segs = path.split('/').filter(Boolean)
      const toTitle = (s: string) => s.replace(/[-_]/g, ' ').replace(/^\w/, c => c.toUpperCase())
      const keep = hideParams ? segs.filter(s => !/^\d+$/i.test(s) && !/^[0-9a-f-]{8,}$/i.test(s)) : segs
      const acc: string[] = []
      keep.forEach((s, idx) => {
        acc.push(s)
        const full = '/' + acc.join('/')
        const isLast = idx === keep.length - 1
        result.push({ title: toTitle(s), href: !isLast || lastClickable ? full : undefined })
      })
    }

    return result
  }, [items, pathname, menus, hideParams, lastClickable])

  return (
    <div
      className={className}
      style={{
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        ...style,
      }}
    >
      <Breadcrumb
        items={autoItems.map((i, idx) => {
          const isLast = idx === autoItems.length - 1
          return {
            title:
              isLast || !i.href ? (
                i.title
              ) : (
                <a
                  href={i.href}
                  onClick={e => {
                    e.preventDefault()
                    navigate(i.href!)
                  }}
                >
                  {i.title}
                </a>
              ),
          }
        })}
      />
      {extra}
    </div>
  )
}
