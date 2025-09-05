import { IconRenderer } from '@shared/components/IconRenderer'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { MenuItem, useMenuPermissions } from '@shared/hooks/useMenuPermissions'
import { ChevronDown, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

interface DynamicSidebarProps {
  className?: string
  collapsed?: boolean
  onToggle?: () => void
}

const LS_OPEN_KEYS = 'sidebar.openKeys.v1'

/** 动态段判定，如 /exams/:id 或 /foo/[id] 或包含 {} */
const hasDynamicSegment = (p?: string) => !!p && /[:\[\{]/.test(p)

/** 根据当前路径判断菜单或后代是否命中 */
function isActiveByPath(menu: MenuItem, pathname: string): boolean {
  if (menu.path && (pathname === menu.path || pathname.startsWith(menu.path + '/'))) return true
  if (Array.isArray(menu.children)) return menu.children.some(c => isActiveByPath(c, pathname))
  return false
}

/** 找到所有命中的祖先 id，用于自动展开 */
function collectActiveAncestors(menus: MenuItem[], pathname: string, stack: number[] = [], out: number[] = []) {
  for (const m of menus) {
    const next = [...stack, m.id]
    if (isActiveByPath(m, pathname)) out.push(...stack)
    if (m.children?.length) collectActiveAncestors(m.children, pathname, next, out)
  }
  return Array.from(new Set(out))
}

/** 获取第一个有效子菜单 path */
function firstValidChildPath(menu: MenuItem): string | undefined {
  if (!menu.children?.length) return undefined
  for (const c of menu.children) {
    if (c.path && !hasDynamicSegment(c.path)) return c.path
    const deep = firstValidChildPath(c)
    if (deep) return deep
  }
  return undefined
}

/** 计算父级点击时应该跳到哪里 */
function resolveParentTarget(menu: MenuItem): string | undefined {
  // 先跳子级的第一个有效 path
  const child = firstValidChildPath(menu)
  if (child) return child
  // 父级自身 path 仅当不是动态段时可用
  if (menu.path && !hasDynamicSegment(menu.path)) return menu.path
  return undefined
}

/** 使整行命中：无子菜单时把整行包成 NavLink */
function RowLink({
  to,
  children,
  style,
  onClick,
}: {
  to: string
  children: React.ReactNode
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        textDecoration: 'none',
        color: isActive ? '#1976d2' : '#374151',
        backgroundColor: isActive ? '#e3f2fd' : 'transparent',
        borderRight: isActive ? '2px solid #1976d2' : '2px solid transparent',
        borderRadius: 8,
        transition: 'background-color 0.15s ease',
        ...style,
      })}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        if ((el.style.color || '').indexOf('#1976d2') === -1) el.style.backgroundColor = '#f5f5f5'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        if ((el.style.color || '').indexOf('#1976d2') === -1) el.style.backgroundColor = 'transparent'
      }}
    >
      {children}
    </NavLink>
  )
}

export default function DynamicSidebar({ className = '', collapsed = false, onToggle }: DynamicSidebarProps) {
  const { menus, loading, error } = useMenuPermissions()
  const location = useLocation()
  const navigate = useNavigate()

  /** 展开项（持久化） */
  const [openKeys, setOpenKeys] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(LS_OPEN_KEYS)
      if (!raw) return new Set()
      const arr: number[] = JSON.parse(raw)
      return new Set(arr)
    } catch {
      return new Set()
    }
  })

  /** 点击节流，防止误触与重复跳转 */
  const lockRef = useRef(false)
  const throttled = useCallback((fn: () => void) => {
    if (lockRef.current) return
    lockRef.current = true
    fn()
    setTimeout(() => {
      lockRef.current = false
    }, 200)
  }, [])

  /** 展开/收起并持久化 */
  const toggleOpen = (id: number) => {
    const next = new Set(openKeys)
    next.has(id) ? next.delete(id) : next.add(id)
    setOpenKeys(next)
    localStorage.setItem(LS_OPEN_KEYS, JSON.stringify(Array.from(next)))
  }

  /** 路由变化：自动展开命中祖先 */
  useEffect(() => {
    const ancestors = collectActiveAncestors(menus, location.pathname)
    if (ancestors.length) {
      const merged = new Set([...openKeys, ...ancestors])
      setOpenKeys(merged)
      localStorage.setItem(LS_OPEN_KEYS, JSON.stringify(Array.from(merged)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, menus])

  /** 路由变化：如果当前正落在“仅父级 path（或动态段父级）”，自动跳到其第一个有效子菜单 */
  useEffect(() => {
    // 深度优先查找与 pathname 完全相等的菜单
    const stack: MenuItem[] = [...menus]
    while (stack.length) {
      const m = stack.shift()!
      if (m.path === location.pathname && m.children?.length) {
        const target = resolveParentTarget(m)
        if (target && target !== location.pathname) {
          navigate(target, { replace: true })
        }
        break
      }
      if (m.children?.length) stack.push(...m.children)
    }
  }, [location.pathname, menus, navigate])

  const isActiveMemo = useCallback((m: MenuItem) => isActiveByPath(m, location.pathname), [location.pathname])

  const renderRow = (menu: MenuItem, level = 0): React.ReactNode => {
    const hasChildren = !!menu.children?.length
    const isOpen = openKeys.has(menu.id)
    const isActive = isActiveMemo(menu)
    const indent = collapsed ? 0 : level * 14

    const Icon = (
      <span
        style={{
          width: 20,
          height: 20,
          marginRight: collapsed ? 0 : 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconRenderer icon={menu.icon || 'lucide:LayoutDashboard'} size={18} />
      </span>
    )

    // —— 无子菜单：整行可点 —— //
    if (!hasChildren) {
      const to = menu.path || '/'
      return (
        <RowLink key={menu.id} to={to} onClick={() => throttled(() => {})} style={{ paddingLeft: 12 + indent }}>
          {Icon}
          {!collapsed && <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{menu.title}</span>}
        </RowLink>
      )
    }

    // —— 有子菜单：标题跳“安全目标”，箭头仅负责展开 —— //
    const safeTarget = resolveParentTarget(menu)

    return (
      <div key={menu.id}>
        <div
          role="group"
          aria-expanded={isOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            paddingLeft: 12 + indent,
            borderRadius: 8,
            cursor: 'default',
            color: isActive ? '#1976d2' : '#374151',
            backgroundColor: isActive ? '#e3f2fd' : 'transparent',
            borderRight: isActive ? '2px solid #1976d2' : '2px solid transparent',
            transition: 'background-color 0.15s ease',
          }}
        >
          {Icon}

          {!collapsed && (
            <button
              type="button"
              onClick={() => {
                if (!safeTarget) {
                  // 没有可跳的目标则只展开
                  throttled(() => toggleOpen(menu.id))
                  return
                }
                throttled(() => navigate(safeTarget))
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (!safeTarget) throttled(() => toggleOpen(menu.id))
                  else throttled(() => navigate(safeTarget))
                }
              }}
              title={menu.title}
              style={{
                flex: 1,
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                color: 'inherit',
                padding: 0,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {menu.title}
            </button>
          )}

          {!collapsed && (
            <button
              type="button"
              aria-label={isOpen ? '收起' : '展开'}
              onClick={() => throttled(() => toggleOpen(menu.id))}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  throttled(() => toggleOpen(menu.id))
                }
              }}
              style={{
                marginLeft: 8,
                padding: 4,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              {isOpen ? <ChevronDown width={16} height={16} /> : <ChevronRight width={16} height={16} />}
            </button>
          )}
        </div>

        {!collapsed && isOpen && (
          <div style={{ marginTop: 4 }}>{menu.children!.map(child => renderRow(child, level + 1))}</div>
        )}
      </div>
    )
  }

  const content = useMemo(() => {
    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, height: '100%' }}>
          <LoadingSpinner size="sm" />
        </div>
      )
    }
    if (error) {
      return (
        <div style={{ padding: 16 }}>
          <div style={{ textAlign: 'center', color: '#dc2626' }}>
            <p style={{ fontSize: 14 }}>菜单加载失败</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{error}</p>
          </div>
        </div>
      )
    }
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{menus.map(m => renderRow(m))}</div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, menus, openKeys, collapsed, location.pathname])

  return (
    <aside
      className={className}
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        borderRight: '1px solid #e5e7eb',
      }}
    >
      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!collapsed && <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>在线考试系统</h2>}
          {onToggle && (
            <button
              onClick={onToggle}
              style={{
                padding: 4,
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-label={collapsed ? '展开菜单' : '收起菜单'}
              title={collapsed ? '展开菜单' : '收起菜单'}
            >
              <ChevronRight
                style={{
                  width: 16,
                  height: 16,
                  transition: 'transform 0.2s',
                  transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
              />
            </button>
          )}
        </div>
      </div>

      <nav style={{ padding: 16, flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 80px)' }}>{content}</nav>
    </aside>
  )
}

/* ===================== 移动端抽屉 ===================== */

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const { menus, loading } = useMenuPermissions()
  const location = useLocation()

  const renderItem = (menu: MenuItem) => {
    const active = isActiveByPath(menu, location.pathname)
    const to = menu.path || '/'
    return (
      <NavLink
        key={menu.id}
        to={to}
        onClick={onClose}
        style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          textDecoration: 'none',
          color: isActive || active ? '#1d4ed8' : '#374151',
          backgroundColor: isActive || active ? '#eff6ff' : '#fff',
        })}
      >
        <span className="w-6 h-6 mr-3 text-lg" style={{ width: 24, height: 24, marginRight: 12 }}>
          <IconRenderer icon={menu.icon || 'lucide:LayoutDashboard'} size={18} />
        </span>
        <span className="text-sm font-medium">{menu.title}</span>
      </NavLink>
    )
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50 md:hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">菜单</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="关闭菜单"
            >
              ✕
            </button>
          </div>
        </div>
        <nav className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            menus.filter(m => !m.parent_id).map(renderItem)
          )}
        </nav>
      </div>
    </>
  )
}
