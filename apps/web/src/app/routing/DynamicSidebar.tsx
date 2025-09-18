import React, { useEffect, useMemo, useState } from 'react'
import { Drawer, Menu } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconRenderer } from '@/shared/components/IconRenderer'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { MenuItem, useMenuPermissions } from '@/shared/hooks/useMenuPermissions'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DynamicSidebarProps {
  className?: string
  collapsed?: boolean
  width?: number
  onToggle?: () => void
}

const hasDynamic = (p?: string) => !!p && /[:\[\{]/.test(p)
const keyOf = (m: MenuItem) => (m.path && !hasDynamic(m.path) ? m.path : `g-${m.id}`)

function toAntdItems(list: MenuItem[]): any[] {
  const walk = (ms: MenuItem[]): any[] =>
    ms
      .filter(m => !m.is_hidden)
      .map(m => {
        const key = keyOf(m)
        const icon = <IconRenderer icon={m.icon || 'lucide:LayoutDashboard'} size={18} />
        if (m.children?.length) return { key, icon, label: m.title, children: walk(m.children) }
        if (m.path && !hasDynamic(m.path)) return { key: m.path, icon, label: m.title }
        return null
      })
      .filter(Boolean) as any[]
  return walk(list)
}

function findSelectedKey(menus: MenuItem[], pathname: string): string | undefined {
  let best: { depth: number; key: string } | null = null
  const walk = (ms: MenuItem[], depth: number) => {
    for (const m of ms) {
      if (m.path && !hasDynamic(m.path) && (pathname === m.path || pathname.startsWith(m.path + '/'))) {
        if (!best || depth > best.depth) best = { depth, key: m.path }
      }
      if (m.children?.length) walk(m.children, depth + 1)
    }
  }
  walk(menus, 1)
  return best?.key
}

function findAncestorKeys(menus: MenuItem[], selectedKey?: string): string[] {
  if (!selectedKey) return []
  const path: string[] = []
  let found = false
  const dfs = (ms: MenuItem[], stack: string[]) => {
    for (const m of ms) {
      const k = keyOf(m)
      const next = [...stack, k]
      if (m.path && !hasDynamic(m.path) && m.path === selectedKey) {
        path.push(...stack)
        found = true
        return
      }
      if (m.children?.length) {
        dfs(m.children, next)
        if (found) return
      }
    }
  }
  dfs(menus, [])
  return path.filter(k => k.startsWith('g-'))
}

/* 桌面侧栏 */
export default function DynamicSidebar({
  className = '',
  collapsed = false,
  width = 240,
  onToggle,
}: DynamicSidebarProps) {
  const { menus, loading, error } = useMenuPermissions()
  const location = useLocation()
  const navigate = useNavigate()

  const items = useMemo<any[]>(() => toAntdItems(menus), [menus])
  const selectedKey = useMemo(() => findSelectedKey(menus, location.pathname), [menus, location.pathname])
  const initialOpen = useMemo(() => findAncestorKeys(menus, selectedKey), [menus, selectedKey])

  const [openKeys, setOpenKeys] = useState<string[]>(initialOpen)
  useEffect(() => setOpenKeys(initialOpen), [initialOpen])

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
      {/* 顶部条：Logo + 折叠按钮（固定在侧栏顶部） */}
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
        selectedKeys={selectedKey ? [selectedKey] : []}
        openKeys={collapsed ? undefined : openKeys}
        onOpenChange={ks => setOpenKeys(ks as string[])}
        onClick={info => {
          const k = String(info.key)
          if (k.startsWith('/')) navigate(k)
        }}
        style={{ borderRight: 0, padding: 8 }}
      />
    </aside>
  )
}

/* 移动端抽屉侧栏（保留） */
export function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { menus, loading } = useMenuPermissions()
  const location = useLocation()
  const navigate = useNavigate()

  const items = useMemo<any[]>(() => toAntdItems(menus), [menus])
  const selectedKey = useMemo(() => findSelectedKey(menus, location.pathname), [menus, location.pathname])

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
          selectedKeys={selectedKey ? [selectedKey] : []}
          onClick={info => {
            const k = String(info.key)
            if (k.startsWith('/')) {
              navigate(k)
              onClose()
            }
          }}
          style={{ borderRight: 0, padding: 8 }}
        />
      )}
    </Drawer>
  )
}
