import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Drawer, Menu, Tooltip } from 'antd'
import { useLocation } from 'react-router-dom'
import { IconRenderer } from '@/shared/components/IconRenderer'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { MenuItem, useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'
import { useTabs } from '@/shared/contexts/TabsContext'
import { useLayout } from '@/shared/contexts/LayoutContext'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import '../css/DynamicSidebar.css'

/* ---------- 小工具 ---------- */
const hasDynamic = (p?: string) => !!p && /[:\[\{]/.test(p || '')
const norm = (p: string) => (p || '').replace(/\/+$/, '') || '/'
const cleanPath = (p?: string | null) =>
  ('/' + (p || '')).replace(/\/{2,}/g, '/').replace(/(?:\/index|-index)(?=\/?$)/, '')

function readHiddenRaw(m: any): any {
  if (!m) return undefined
  if (m.is_hidden !== undefined) return m.is_hidden
  if (m.isHidden !== undefined) return m.isHidden
  if (m.hidden !== undefined) return m.hidden
  if (m.meta?.hidden !== undefined) return m.meta.hidden
  if (m.meta?.is_hidden !== undefined) return m.meta.is_hidden
  if (typeof m.meta?.visible === 'boolean') return !m.meta.visible
  return undefined
}
const isHiddenFlag = (v: any) =>
  v === true || v === 1 || (typeof v === 'string' && ['1', 'true', 'yes'].includes(v.trim().toLowerCase()))
const safeNotHidden = (m: any) => !isHiddenFlag(readHiddenRaw(m))
const shouldShowInMenu = (m: any) => {
  if (!safeNotHidden(m)) return false
  const p = (m?.path ?? '').trim()
  if (p && hasDynamic(p)) return false
  return true
}

/** 混合模式：优先 activeRootId；否则按当前地址推断根 */
function pickMixRoot(menus: MenuItem[], activeRootId?: string | null, pathname = '/') {
  const roots = (menus || []).filter(shouldShowInMenu)
  let root = roots.find(r => String((r as any).id) === String(activeRootId || ''))
  if (root) return root

  const pn = norm(cleanPath(pathname))
  let matched: MenuItem | null = null

  const dfs = (list: MenuItem[], top: MenuItem) => {
    for (const m of list || []) {
      if (!shouldShowInMenu(m)) continue
      const raw = (m as any).path
      if (raw && !hasDynamic(raw)) {
        const p = norm(cleanPath(raw))
        if (pn === p || pn.startsWith(p + '/')) matched = top
      }
      if ((m as any).children?.length) dfs((m as any).children, top)
      if (matched) return
    }
  }
  for (const r of roots) {
    dfs([r], r)
    if (matched) break
  }
  return matched || roots[0] || null
}

/* ---------- 构建 items & 映射 ---------- */
function buildMenuArtifacts(menus: MenuItem[]) {
  type AntdItem = any
  const items: AntdItem[] = []
  const id2path = new Map<string, string>()
  const id2title = new Map<string, string>()
  const id2redirect = new Map<string, string>()
  const parent = new Map<string, string | null>()
  const rootOpenableKeys: string[] = []

  const walk = (list: MenuItem[], parentId: string | null): AntdItem[] =>
    (list || []).filter(shouldShowInMenu).map(m => {
      const id = String((m as any).id)
      parent.set(id, parentId)
      id2title.set(id, (m as any).title)

      const pathRaw = (m as any).path
      if (pathRaw && !hasDynamic(pathRaw)) {
        const p = cleanPath(pathRaw)
        if (p) id2path.set(id, p)
      }
      const redirectRaw = (m as any).redirect
      if (redirectRaw) id2redirect.set(id, cleanPath(redirectRaw))

      const iconName = (m as any).icon || 'lucide:LayoutDashboard'
      const icon = <IconRenderer icon={iconName} size={18} />
      const children = ((m as any).children || []).filter(shouldShowInMenu)

      if (children.length) {
        if (parentId === null) rootOpenableKeys.push(id)
        return { key: id, icon, label: (m as any).title, title: (m as any).title, children: walk(children, id) }
      }
      return { key: id, icon, label: (m as any).title, title: (m as any).title }
    })

  items.push(...walk(menus as any, null))
  return { items, id2path, id2title, id2redirect, parent, rootOpenableKeys }
}

/* ---------- 选中态：用清洗后的 path 匹配 ---------- */
function findActiveIdByPath(menus: MenuItem[], pathname: string): string | undefined {
  const pn = norm(cleanPath(pathname))
  let best: { id: string; depth: number; len: number } | null = null
  const dfs = (list: MenuItem[], depth: number) => {
    for (const raw of list || []) {
      if (!safeNotHidden(raw)) continue
      const m: any = raw
      if (m.path && !hasDynamic(m.path)) {
        const p = norm(cleanPath(m.path))
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

/* ====== 底部控制 SVG ====== */
type SvgIconProps = React.SVGProps<SVGSVGElement> & { size?: number; collapsed?: boolean }
const IconCollapse = ({ size = 16, collapsed, style, ...rest }: SvgIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="false"
    style={{ transform: collapsed ? 'rotateY(180deg)' : 'none', outline: 'none', ...style }}
    {...rest}
  >
    <path fill="currentColor" d="M21 18v2H3v-2zM7 3.5v10l-5-5zM21 11v2h-9v-2zm0-7v2h-9V4z" />
  </svg>
)

const HEADER_H = 55
const BOTTOM_CTRL_H = 44

/* ====== 新增：仪表盘路径查找 + 跳转 ====== */
const DASHBOARD_CANDIDATES = ['/dashboard', '/home', '/'] // 可按需再加别名
function findDashboardPath(menus: MenuItem[]): string {
  const list: any[] = menus || []
  const all: any[] = []
  const dfs = (arr: any[]) =>
    arr?.forEach(m => {
      all.push(m)
      m.children && dfs(m.children)
    })
  dfs(list)
  for (const c of DASHBOARD_CANDIDATES) {
    const pc = cleanPath(c)
    const hit = all.find(m => cleanPath((m as any).path || '') === pc)
    if (hit) return pc
  }
  return '/dashboard' // 兜底
}

/* ======================== 桌面侧栏 ======================== */
export default function DynamicSidebar({ className = '', width = 240 }: { className?: string; width?: number }) {
  const { mode, collapsed, showBrand, activeRootId, toggleCollapsed } = useLayout()
  const { menus, loading, error } = useMenuPermissions()
  const location = useLocation()
  const { addOrActivate } = useTabs()

  const [hovered, setHovered] = useState(false)
  const asideRef = useRef<HTMLDivElement>(null)

  const [inlineCollapsed, setInlineCollapsed] = useState(collapsed)
  const [hideLabel, setHideLabel] = useState(collapsed)

  useEffect(() => {
    if (collapsed) {
      setHideLabel(true)
      const t = setTimeout(() => setInlineCollapsed(true), 100)
      return () => clearTimeout(t)
    } else {
      setInlineCollapsed(false)
      setHideLabel(true)
      const el = asideRef.current
      const finish = () => setHideLabel(false)
      if (el) {
        const onEnd = (e: TransitionEvent) => {
          if (e.propertyName === 'width') {
            finish()
            el.removeEventListener('transitionend', onEnd)
          }
        }
        el.addEventListener('transitionend', onEnd)
        return () => el.removeEventListener('transitionend', onEnd)
      } else {
        const t = setTimeout(finish, 240)
        return () => clearTimeout(t)
      }
    }
  }, [collapsed])

  // 顶部模式不渲染侧栏
  if (mode === 'top') return null

  // mix：只展示当前“根菜单”的 children；side：展示整棵
  const scopedMenus = useMemo(() => {
    if (mode !== 'mix') return menus
    const root = pickMixRoot(menus, activeRootId, location.pathname)
    return (root?.children as any[]) || []
  }, [menus, mode, activeRootId, location.pathname])

  const { items, id2path, id2title, id2redirect, parent, rootOpenableKeys } = useMemo(
    () => buildMenuArtifacts(scopedMenus),
    [scopedMenus]
  )

  const selectedId = useMemo(() => findActiveIdByPath(scopedMenus, location.pathname), [scopedMenus, location.pathname])
  const mustOpenAncestors = useMemo(() => collectAncestorIds(parent, selectedId), [parent, selectedId])

  const [openKeys, setOpenKeys] = useState<string[]>(mustOpenAncestors)
  useEffect(() => {
    if (collapsed) return
    setOpenKeys(mustOpenAncestors)
  }, [mustOpenAncestors, collapsed])

  const dashboardPath = useMemo(() => findDashboardPath(menus), [menus]) // ← 仪表盘路径
  const goDashboard = () => {
    const p = cleanPath(dashboardPath)
    ;(window as any).scrollTo?.(0, 0)
    addOrActivate({ key: p, title: '仪表盘', closable: p !== '/' })
  }

  const siderW = collapsed ? 64 : width
  const brandH = showBrand ? HEADER_H : 0

  /* ====== 加载 / 错误骨架 ====== */
  if (loading) {
    return (
      <aside
        className={`app-sider ${className || ''}`}
        style={{
          position: 'fixed',
          zIndex: 1100,
          inset: '0 auto 0 0',
          width: siderW,
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <LoadingSpinner size="sm" center={false} />
        </div>
      </aside>
    )
  }
  if (error) {
    return (
      <aside
        className={`app-sider ${className || ''}`}
        style={{
          position: 'fixed',
          zIndex: 1100,
          inset: '0 auto 0 0',
          width: siderW,
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div style={{ padding: 16, color: '#dc2626' }}>菜单加载失败：{error}</div>
      </aside>
    )
  }

  /* ====== 主体 ====== */
  return (
    <aside
      ref={asideRef}
      className={`app-sider ${className || ''}`}
      data-collapsed={collapsed ? '1' : '0'}
      data-hide-label={hideLabel ? '1' : '0'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        zIndex: 1100,
        left: 0,
        top: 0,
        bottom: 0,
        width: siderW,
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
        overflowX: 'hidden',
        overflow: 'hidden',
        boxSizing: 'border-box',
        cursor: 'default',
      }}
    >
      {/* 顶部品牌区 —— 点击返回仪表盘 */}
      {showBrand && (
        <Tooltip title="回到仪表盘">
          <div
            role="button"
            tabIndex={0}
            aria-label="回到仪表盘"
            onClick={goDashboard}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && goDashboard()}
            style={{
              height: HEADER_H,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 12px',
              boxSizing: 'border-box',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <img
              src="/brand-logo.svg"
              alt="Logo"
              width={20}
              height={20}
              style={{ display: 'block' }}
              onError={e => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
            />
            {!collapsed && (
              <strong className="brand-title" style={{ fontSize: 14 }}>
                在线考试系统
              </strong>
            )}
          </div>
        </Tooltip>
      )}

      {/* 菜单滚动区（预留底部固定区域高度） */}
      <div className="menu-wrap" style={{ height: `calc(100% - ${brandH + BOTTOM_CTRL_H}px)`, overflowY: 'auto' }}>
        <Menu
          mode="inline"
          selectable
          inlineCollapsed={inlineCollapsed}
          triggerSubMenuAction="hover"
          items={items}
          selectedKeys={selectedId ? [selectedId] : []}
          openKeys={collapsed ? undefined : openKeys}
          style={{ borderRight: 0, width: '100%' }}
          motion={{ motionAppear: false, motionEnter: true, motionLeave: true, motionDeadline: 300 }}
          onOpenChange={nextKeys => {
            if (collapsed) return
            const next = nextKeys as string[]
            const newlyOpened = next.find(k => !openKeys.includes(k))
            if (newlyOpened && rootOpenableKeys.includes(newlyOpened)) {
              const filtered = next.filter(k => !rootOpenableKeys.includes(k))
              filtered.push(newlyOpened)
              setOpenKeys(filtered)
            } else setOpenKeys(next)
          }}
          onClick={({ key, keyPath }) => {
            const id = String(key)
            const path = id2path.get(id)
            const title = id2title.get(id) || ''

            if (path) {
              const p = cleanPath(path)
              ;(window as any).scrollTo?.(0, 0)
              addOrActivate({ key: p, title, closable: p !== '/' })
              return
            }
            const redirect = id2redirect.get(id)
            if (redirect) {
              const p = cleanPath(redirect)
              ;(window as any).scrollTo?.(0, 0)
              addOrActivate({ key: p, title: title || '菜单', closable: p !== '/' })
              return
            }

            if (!collapsed) {
              const parentId = (keyPath?.[1] as string) || null
              if (parentId) setOpenKeys(prev => Array.from(new Set([...prev, parentId])))
            }
          }}
        />
      </div>

      {/* 右侧悬浮折叠按钮（可选） */}
      <div
        className="hover-toggle"
        style={{
          position: 'absolute',
          top: '50%',
          right: 2,
          transform: 'translateY(-50%)',
          zIndex: 1200,
          pointerEvents: hovered ? 'auto' : 'none',
        }}
      >
        <Tooltip title={collapsed ? '点击展开' : '点击折叠'} placement="right">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            style={{
              width: 24,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 4,
              border: '1px solid rgba(0,0,0,.08)',
              background: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,.08)',
              cursor: 'pointer',
            }}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </Tooltip>
      </div>

      {/* 底部固定控制 */}
      <div
        className="bottom-collapse"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: BOTTOM_CTRL_H,
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
        }}
      >
        <IconCollapse
          collapsed={collapsed}
          size={16}
          style={{ cursor: 'pointer' }}
          onClick={toggleCollapsed}
          onMouseDown={e => e.preventDefault()}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </aside>
  )
}

/* ======================== 移动端抽屉侧栏 ======================== */
export function MobileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { menus, loading } = useMenuPermissions()
  const location = useLocation()
  const { addOrActivate } = useTabs()

  const { items, id2path, id2title } = useMemo(() => {
    const built = buildMenuArtifacts(menus)
    return { items: built.items, id2path: built.id2path, id2title: built.id2title }
  }, [menus])

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
              const p = cleanPath(path)
              addOrActivate({ key: p, title, closable: p !== '/' })
              onClose()
            }
          }}
          style={{ borderRight: 0, padding: 8 }}
        />
      )}
    </Drawer>
  )
}
