import React, { useMemo } from 'react'
import { Menu } from 'antd'
import { useLocation } from 'react-router-dom'
import { IconRenderer } from '@/shared/components/IconRenderer'
import { useTabs } from '@/shared/contexts/TabsContext'
import { useMenuPermissions, type MenuItem } from '@/shared/contexts/MenuPermissionContext'
import { useLayout } from '@/shared/contexts/LayoutContext'

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
/** 统一清洗路径：去多余斜杠 + 去掉结尾的 -index 或 /index */
const cleanPath = (p?: string | null) =>
  ('/' + (p || '')).replace(/\/{2,}/g, '/').replace(/(?:\/index|-index)(?=\/?$)/, '')

/** 找某节点的“第一个可访问子页面”路径（遇到静态 path 就返回） */
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
/** mix=true 时仅构建“根级 items”；否则构建整棵（可下拉） */
function buildItems(menus: MenuItem[], mix: boolean) {
  const items: AntdItem[] = []
  const id2path = new Map<string, string>() // 任意节点自身 path
  const id2title = new Map<string, string>() // 任意节点标题
  const id2firstLeaf = new Map<string, string | null>() // 任意节点“第一个可访问子页面”

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
      return { key: id, icon: mkIcon(m), label: m.title } as AntdItem // ✅ 只根级，无 children
    })

  items.push(...(mix ? rootsOnly(menus) : walk(menus)))
  return { items, id2path, id2title, id2firstLeaf }
}

export default function TopNav({ style }: { style?: React.CSSProperties }) {
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

  // 选中态：mix 优先用 activeRootId；否则根据当前地址匹配
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
    // 如果没命中任何自身 path，再用“第一个可访问子页面”来匹配根
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

        // 混合模式：点击根菜单只切根 & 跳转到自身 path 或第一个可访问子叶
        if (mode === 'mix' && setActiveRootId) setActiveRootId(id)

        const target =
          id2path.get(id) ||
          id2firstLeaf.get(id) || // 无自身 path 就用第一个子页面
          null

        if (target) {
          const title = id2title.get(id) || ''
          const clean = cleanPath(target)
          addOrActivate({ key: clean, title, closable: clean !== '/' })
        }
      }}
    />
  )
}
