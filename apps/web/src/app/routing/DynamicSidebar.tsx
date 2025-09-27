import React, { useEffect, useMemo, useState } from 'react'
import { Drawer, Menu } from 'antd'
import { useLocation } from 'react-router-dom'
import { IconRenderer } from '@/shared/components/IconRenderer'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { MenuItem, useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTabs } from '@/shared/contexts/TabsContext'

interface DynamicSidebarProps {
  className?: string
  collapsed?: boolean
  width?: number
  onToggle?: () => void
}

/** 动态路由判定（带 : / [ ] / { } 认为是动态） */
const hasDynamic = (p?: string) => !!p && /[:\[\{]/.test(p || '')

/** 归一化路径末尾斜杠 */
const norm = (p: string) => (p || '').replace(/\/+$/, '') || '/'

/** 根据用户菜单构建：antd items、id->path、id->title、parentId 映射 */
function buildMenuArtifacts(menus: MenuItem[]) {
  type AntdItem = any
  const items: AntdItem[] = []
  const id2path = new Map<string, string>()
  const id2title = new Map<string, string>()
  const parent = new Map<string, string | null>() // childId -> parentId

  const walk = (list: MenuItem[], parentId: string | null): AntdItem[] =>
    list
      .filter(m => !m.is_hidden)
      .map(m => {
        const id = String(m.id) // ✅ 所有 key 一律用 id
        parent.set(id, parentId)
        id2title.set(id, m.title)
        if (m.path && !hasDynamic(m.path)) id2path.set(id, m.path)

        const icon = <IconRenderer icon={m.icon || 'lucide:LayoutDashboard'} size={18} />

        if (m.children?.length) {
          return { key: id, icon, label: m.title, children: walk(m.children, id) }
        }
        return { key: id, icon, label: m.title }
      })

  items.push(...walk(menus, null))
  return { items, id2path, id2title, parent }
}

/** 找到当前 pathname 对应的“最深匹配”的菜单 id（用 path 前缀匹配，越深越优先） */
function findActiveIdByPath(menus: MenuItem[], pathname: string): string | undefined {
  const pn = norm(pathname)
  let best: { id: string; depth: number; len: number } | null = null

  const dfs = (list: MenuItem[], depth: number) => {
    for (const m of list) {
      if (m.path && !hasDynamic(m.path)) {
        const p = norm(m.path)
        if (pn === p || pn.startsWith(p + '/')) {
          const id = String(m.id)
          const len = p.length
          if (!best || depth > best.depth || (depth === best.depth && len > best.len)) {
            best = { id, depth, len }
          }
        }
      }
      if (m.children?.length) dfs(m.children, depth + 1)
    }
  }
  dfs(menus, 1)
  return best?.id
}

/** 回溯祖先 id（不含自己），从近到远（父->祖父->...）需要 open 的 SubMenu keys */
function collectAncestorIds(parent: Map<string, string | null>, id?: string): string[] {
  const out: string[] = []
  let cur = id
  while (cur) {
    const p = parent.get(cur) || null
    if (!p) break
    out.unshift(p)
    cur = p
  }
  return out
}

/* ======================== 桌面侧栏 ======================== */
export default function DynamicSidebar({
  className = '',
  collapsed = false,
  width = 240,
  onToggle,
}: DynamicSidebarProps) {
  const { menus, loading, error } = useMenuPermissions()
  const location = useLocation()
  const { addOrActivate } = useTabs()

  // 统一构建 items / 各种映射
  const { items, id2path, id2title, parent } = useMemo(() => buildMenuArtifacts(menus), [menus])

  // 选中项：用“最深匹配”的 id
  const selectedId = useMemo(() => findActiveIdByPath(menus, location.pathname), [menus, location.pathname])

  // 必须保持展开的祖先 keys
  const mustOpenAncestors = useMemo(() => collectAncestorIds(parent, selectedId), [parent, selectedId])

  // 当前展开 keys（受控）。初始化为必须展开的祖先；后续合并，避免自动合上。
  const [openKeys, setOpenKeys] = useState<string[]>(mustOpenAncestors)

  // 路由变化 / 选中项变化：把必须展开的祖先“并入” openKeys，保证父级不会自动合上
  useEffect(() => {
    if (collapsed) return
    setOpenKeys(prev => {
      const next = Array.from(new Set([...prev, ...mustOpenAncestors]))
      return next
    })
  }, [mustOpenAncestors, collapsed])

  if (loading) {
    return (
      <aside
        className={className}
        style={{ width, height: '100vh', borderRight: '1px solid #f0f0f0', background: '#fff' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <LoadingSpinner size="sm" center={false} />
        </div>
      </aside>
    )
  }
  if (error) {
    return (
      <aside
        className={className}
        style={{ width, height: '100vh', borderRight: '1px solid #f0f0f0', background: '#fff' }}
      >
        <div style={{ padding: 16, color: '#dc2626' }}>菜单加载失败：{error}</div>
      </aside>
    )
  }

  return (
    <aside
      className={className}
      style={{
        width,
        height: '100vh',
        borderRight: '1px solid #f0f0f0',
        background: '#fff',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch' as any,
      }}
    >
      {/* 顶部条：Logo + 折叠按钮 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 8px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            textDecoration: 'none',
            color: 'inherit',
          }}
          title="首页"
        >
          <img src="/brand-logo.svg" alt="Logo" width={24} height={24} style={{ display: 'block', flexShrink: 0 }} />
          {!collapsed && <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>在线考试系统</span>}
        </a>

        <button
          onClick={onToggle}
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          title={collapsed ? '展开菜单' : '收起菜单'}
          aria-label={collapsed ? '展开菜单' : '收起菜单'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <Menu
        mode="inline"
        selectable
        inlineCollapsed={collapsed}
        items={items}
        // ✅ Menu 的 key 全部是 id
        selectedKeys={selectedId ? [selectedId] : []}
        openKeys={collapsed ? undefined : openKeys}
        onOpenChange={ks => setOpenKeys(ks as string[])}
        onClick={({ key }) => {
          const id = String(key)
          const path = id2path.get(id)
          if (path) {
            const title = id2title.get(id) || ''
            // Tabs 的 key 仍然用 path，避免改变你现有的标签逻辑
            addOrActivate({ key: path, title, closable: path !== '/' })
          }
        }}
        style={{ borderRight: 0, padding: 8 }}
      />
    </aside>
  )
}

/* ======================== 移动端抽屉侧栏 ======================== */
export function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { menus, loading } = useMenuPermissions()
  const location = useLocation()
  const { addOrActivate } = useTabs()

  const { items, id2path, id2title } = useMemo(() => buildMenuArtifacts(menus), [menus])
  const selectedId = useMemo(() => findActiveIdByPath(menus, location.pathname), [menus, location.pathname])

  return (
    <Drawer
      title="菜单"
      placement="left"
      width={260}
      open={isOpen}
      onClose={onClose}
      styles={{ body: { padding: 0, height: '100%', overflow: 'auto' } }}
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <LoadingSpinner size="sm" center={false} />
        </div>
      ) : (
        <Menu
          mode="inline"
          selectable
          items={items}
          selectedKeys={selectedId ? [selectedId] : []}
          onClick={({ key }) => {
            const id = String(key)
            const path = id2path.get(id)
            if (path) {
              const title = id2title.get(id) || ''
              addOrActivate({ key: path, title, closable: path !== '/' })
              onClose()
            }
          }}
          style={{ borderRight: 0, padding: 8 }}
        />
      )}
    </Drawer>
  )
}
