import React, { useMemo } from 'react'
import { Menu } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconRenderer } from '@/shared/components/IconRenderer'
import { useTabs } from '@/shared/contexts/TabsContext'
import { useMenuPermissions, type MenuItem } from '@/shared/contexts/MenuPermissionContext'
import { useLayout } from '@/shared/contexts/LayoutContext'
import { registerTitle } from '@/shared/contexts/tabsTitleRegistry'

/* ---------- 工具 ---------- */
const hasDynamic = (p?: string) => !!p && /[:\[\{]/.test(p)
const norm = (p: string) => (p || '').replace(/\/+$/, '') || '/'
const showable = (m: any) => {
  const raw =
    m?.is_hidden ??
    m?.hidden ??
    m?.isHidden ??
    m?.meta?.hidden ??
    m?.meta?.is_hidden ??
    (typeof m?.meta?.visible === 'boolean' ? !m.meta.visible : undefined)
  if (raw === true || raw === 1) return false
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s === '1' || s === 'true' || s === 'yes') return false
  }
  return true
}
const cleanPath = (p?: string | null) =>
  ('/' + (p || '')).replace(/\/{2,}/g, '/').replace(/(?:\/index|-index)(?=\/?$)/, '')

/** 找“第一个可访问子页面”的静态路径 */
function firstLeafPath(node?: any): string | null {
  if (!node) return null
  const raw = (node.path || '').trim()
  if (raw && !hasDynamic(raw)) return cleanPath(raw)
  const children = (node.children || []).filter(showable)
  for (const c of children) {
    const p = firstLeafPath(c)
    if (p) return p
  }
  return null
}

type AntdItem = Required<Required<React.ComponentProps<typeof Menu>['items']>[number]>

/* ---------- 构建顶部菜单 ---------- */
function buildItems(menus: MenuItem[], mix: boolean) {
  const items: AntdItem[] = []
  const id2path = new Map<string, string>()
  const id2title = new Map<string, string>()
  const id2firstLeaf = new Map<string, string | null>()

  const mkIcon = (m: any) => <IconRenderer icon={m.icon || 'lucide:LayoutDashboard'} size={16} />

  const walk = (list: MenuItem[]): AntdItem[] =>
    (list || []).filter(showable).map((m: any) => {
      const id = String(m.id)
      id2title.set(id, m.title)
      const rawP = (m.path || '').trim()
      if (rawP && !hasDynamic(rawP)) {
        const p = cleanPath(rawP)
        if (p) id2path.set(id, p)
      }
      id2firstLeaf.set(id, firstLeafPath(m))
      const children = (m.children || []).filter(showable)
      if (children.length) {
        return { key: id, icon: mkIcon(m), label: m.title, children: walk(children) } as AntdItem
      }
      return { key: id, icon: mkIcon(m), label: m.title } as AntdItem
    })

  const rootsOnly = (list: MenuItem[]): AntdItem[] =>
    (list || []).filter(showable).map((m: any) => {
      const id = String(m.id)
      id2title.set(id, m.title)
      const rawP = (m.path || '').trim()
      if (rawP && !hasDynamic(rawP)) {
        const p = cleanPath(rawP)
        if (p) id2path.set(id, p)
      }
      id2firstLeaf.set(id, firstLeafPath(m))
      return { key: id, icon: mkIcon(m), label: m.title } as AntdItem
    })

  items.push(...(mix ? rootsOnly(menus) : walk(menus)))
  return { items, id2path, id2title, id2firstLeaf }
}

export default function TopNav({ style }: { style?: React.CSSProperties }) {
  const navigate = useNavigate()
  const { addOrActivate } = useTabs()
  const { menus } = useMenuPermissions()
  const layout = useLayout() as any
  const mode: 'side' | 'top' | 'mix' = layout.mode
  const activeRootId: string | undefined = layout.activeRootId
  const setActiveRootId: ((id: string | null) => void) | undefined =
    typeof layout.setActiveRootId === 'function' ? layout.setActiveRootId : undefined

  const location = useLocation()
  const roots = useMemo(() => (menus || []).filter(showable), [menus])

  const { items, id2path, id2title, id2firstLeaf } = useMemo(() => buildItems(roots, mode === 'mix'), [roots, mode])

  // 选中态：mix 用 activeRootId；否则用当前路径匹配
  const selectedKeys = useMemo(() => {
    if (mode === 'mix' && activeRootId) return [activeRootId]
    const pn = norm(cleanPath(location.pathname))
    let best: { id: string; len: number } | null = null
    for (const [id, p] of id2path) {
      const np = norm(cleanPath(p))
      if (pn === np || pn.startsWith(np + '/')) {
        if (!best || np.length > best.len) best = { id, len: np.length }
      }
    }
    if (!best && mode === 'mix') {
      for (const [id, fp] of id2firstLeaf) {
        if (!fp) continue
        const np = norm(cleanPath(fp))
        if (pn === np || pn.startsWith(np + '/')) {
          if (!best || np.length > best.len) best = { id, len: np.length }
        }
      }
    }
    return best ? [best.id] : []
  }, [mode, activeRootId, location.pathname, id2path, id2firstLeaf])

  return (
    <Menu
      mode="horizontal"
      selectedKeys={selectedKeys}
      items={items}
      style={{ borderBottom: 'none', height: 47, ...style }}
      onClick={({ key }) => {
        const id = String(key)
        const title = id2title.get(id) || ''

        // ★ 混合模式：优先跳“第一个可访问子页”，避免先到根路径再被重定向
        const target =
          mode === 'mix'
            ? id2firstLeaf.get(id) || id2path.get(id) || null
            : id2path.get(id) || id2firstLeaf.get(id) || null

        if (!target) return
        const clean = cleanPath(target)

        // 登记“最终目标路径 → 中文标题”，供 TabsProvider 使用
        if (title) registerTitle(clean, title)

        if (mode === 'mix') {
          if (typeof setActiveRootId === 'function') setActiveRootId(id)
          navigate(clean) // 只跳转，交给 TabsProvider 建标签（避免重复）
        } else {
          addOrActivate({ key: clean, title: title || clean, closable: clean !== '/' })
        }
      }}
    />
  )
}
