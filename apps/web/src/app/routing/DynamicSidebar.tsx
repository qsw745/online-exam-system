import { IconRenderer } from '@/shared/components/IconRenderer'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { useLayout } from '@/shared/contexts/LayoutContext'
import { useMenuPermissions } from '@/shared/contexts/MenuPermissionContext'
import { useTabs } from '@/shared/contexts/TabsContext'
import { Drawer, Menu, Tooltip } from 'antd'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import '../css/DynamicSidebar.css'

// 宽松菜单类型，避免联合类型在 filter/map 后收敛成 never
type AnyMenu = {
  id?: string | number
  title?: string
  path?: string
  redirect?: string
  icon?: string
  children?: AnyMenu[]
  meta?: any
  is_hidden?: any
  isHidden?: any
  hidden?: any
}

/** 把未知值安全转成菜单数组，彻底避免 never[] 推断 */
function asMenus(v: unknown): AnyMenu[] {
  return Array.isArray(v) ? (v as AnyMenu[]) : []
}

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
const shouldShowInMenu = (m: AnyMenu) => {
  if (!safeNotHidden(m)) return false
  const p = (m?.path ?? '').trim()
  if (p && hasDynamic(p)) return false
  return true
}

/** 混合模式：按当前地址推断根 */
function pickMixRoot(menus: AnyMenu[], _activeRootId?: string | null, pathname = '/') {
  const roots = asMenus(menus).filter(shouldShowInMenu)
  const pn = norm(cleanPath(pathname))
  let matched: AnyMenu | null = null
  const dfs = (list: AnyMenu[], top: AnyMenu) => {
    const arr = asMenus(list)
    for (const m of arr) {
      if (!shouldShowInMenu(m)) continue
      const raw = m?.path
      if (raw && !hasDynamic(raw)) {
        const p = norm(cleanPath(raw))
        if (pn === p || pn.startsWith(p + '/')) matched = top
      }
      const kids = asMenus(m?.children)
      if (kids.length) dfs(kids, top)
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
function buildMenuArtifacts(menus: AnyMenu[]) {
  type AntdItem = any
  const items: AntdItem[] = []
  const id2path = new Map<string, string>()
  const id2title = new Map<string, string>()
  const id2redirect = new Map<string, string>()
  const parent = new Map<string, string | null>()
  const rootOpenableKeys: string[] = []

  const walk = (list: AnyMenu[], parentId: string | null): AntdItem[] => {
    const arr = asMenus(list).filter(shouldShowInMenu)
    return arr.map(m => {
      const id = String(m?.id ?? '')
      parent.set(id, parentId)
      id2title.set(id, String(m?.title ?? ''))

      const pathRaw = m?.path
      if (pathRaw && !hasDynamic(pathRaw)) {
        const p = cleanPath(pathRaw)
        if (p) id2path.set(id, p)
      }
      const redirectRaw = m?.redirect
      if (redirectRaw) id2redirect.set(id, cleanPath(redirectRaw))

      const iconName = m?.icon || 'lucide:LayoutDashboard'
      const icon = <IconRenderer icon={iconName} size={18} />
      const children = asMenus(m?.children).filter(shouldShowInMenu)

      if (children.length) {
        if (parentId === null) rootOpenableKeys.push(id)
        return { key: id, icon, label: m?.title, title: m?.title, children: walk(children, id) }
      }
      return { key: id, icon, label: m?.title, title: m?.title }
    })
  }

  items.push(...walk(asMenus(menus), null))
  return { items, id2path, id2title, id2redirect, parent, rootOpenableKeys }
}

/** 用原始变量跟踪最优匹配，彻底规避 best?.id 的属性访问 */
function findActiveIdByPath(menus: AnyMenu[], pathname: string): string | undefined {
  const pn = norm(cleanPath(pathname))

  let bestId: string | undefined
  let bestDepth = -1
  let bestLen = -1

  const dfs = (list: AnyMenu[], depth: number) => {
    const arr = asMenus(list)
    for (const m of arr) {
      if (!safeNotHidden(m)) continue
      const mp = m?.path
      if (mp && !hasDynamic(mp)) {
        const p = norm(cleanPath(mp))
        if (pn === p || pn.startsWith(p + '/')) {
          const id = m?.id != null ? String(m.id) : ''
          if (id) {
            if (depth > bestDepth || (depth === bestDepth && p.length > bestLen)) {
              bestId = id
              bestDepth = depth
              bestLen = p.length
            }
          }
        }
      }
      const kids = asMenus(m?.children)
      if (kids.length) dfs(kids, depth + 1)
    }
  }

  dfs(asMenus(menus), 1)
  return bestId
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

/* ====== 仪表盘路径查找 + 跳转 ====== */
const DASHBOARD_CANDIDATES = ['/dashboard', '/home', '/']
function findDashboardPath(menus: AnyMenu[]): string {
  const list = asMenus(menus)
  const all: AnyMenu[] = []
  const dfs = (arr: AnyMenu[]) => {
    for (const m of asMenus(arr)) {
      all.push(m)
      const kids = asMenus(m?.children)
      if (kids.length) dfs(kids)
    }
  }
  dfs(list)
  for (const c of DASHBOARD_CANDIDATES) {
    const pc = cleanPath(c)
    const hit = all.find(m => cleanPath(m?.path || '') === pc)
    if (hit) return pc
  }
  return '/dashboard'
}

/* ======================== 桌面侧栏 ======================== */
export default function DynamicSidebar({ className = '', width = 240 }: { className?: string; width?: number }) {
  const { mode, collapsed, showBrand, toggleCollapsed } = useLayout()
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
    if (mode !== 'mix') return asMenus(menus)
    const root = pickMixRoot(asMenus(menus), undefined, location.pathname)
    return asMenus((root as AnyMenu)?.children)
  }, [menus, mode, location.pathname])

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

  const dashboardPath = useMemo(() => findDashboardPath(asMenus(menus)), [menus])
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
    const built = buildMenuArtifacts(asMenus(menus))
    return { items: built.items, id2path: built.id2path, id2title: built.id2title }
  }, [menus])

  const selectedId = useMemo(() => findActiveIdByPath(asMenus(menus), location.pathname), [menus, location.pathname])

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
