import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMenuPermissions, MenuItem } from '../hooks/useMenuPermissions'
import LoadingSpinner from './LoadingSpinner'

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  'home': '🏠',
  'users': '👥',
  'user': '👤',
  'questions': '❓',
  'question-circle': '❓',
  'papers': '📄',
  'file-text': '📄',
  'tasks': '⏰',
  'calendar': '📅',
  'analytics': '📊',
  'bar-chart': '📊',
  'settings': '⚙️',
  'setting': '⚙️',
  'menus': '📋',
  'menu': '📋',
  'dashboard': '📊',
  'exams': '📝',
  'exam': '📝',
  'results': '🏆',
  'trophy': '🏆',
  'profile': '👤',
  'book': '📚',
  'edit': '✏️',
  'unordered-list': '📋',
  'bell': '🔔',
  'heart': '❤️',
  'exclamation-circle': '⚠️',
  'message': '💬',
  'line-chart': '📈'
}

interface DynamicSidebarProps {
  className?: string
  collapsed?: boolean
  onToggle?: () => void
}

export default function DynamicSidebar({ 
  className = '', 
  collapsed = false, 
  onToggle 
}: DynamicSidebarProps) {
  const { menus, loading, error } = useMenuPermissions()
  const location = useLocation()
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set())

  // 切换菜单展开状态
  const toggleMenu = (menuId: number) => {
    const newExpanded = new Set(expandedMenus)
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId)
    } else {
      newExpanded.add(menuId)
    }
    setExpandedMenus(newExpanded)
  }

  // 检查菜单是否激活
  const isMenuActive = (menu: MenuItem): boolean => {
    if (location.pathname === menu.path) {
      return true
    }
    
    // 检查子菜单是否激活
    if (menu.children) {
      return menu.children.some(child => isMenuActive(child))
    }
    
    return false
  }

  // 获取菜单图标
  const getMenuIcon = (menu: MenuItem): React.ReactNode => {
    if (menu.icon) {
      return iconMap[menu.icon] || menu.icon
    }
    return iconMap['dashboard'] // 默认图标
  }

  // 渲染菜单项
  const renderMenuItem = (menu: MenuItem, level = 0) => {
    const hasChildren = menu.children && menu.children.length > 0
    const isActive = isMenuActive(menu)
    const isExpanded = expandedMenus.has(menu.id)
    const indent = level * 16

    return (
      <div key={menu.id}>
        {/* 菜单项 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${12 + indent}px`,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backgroundColor: isActive ? '#e3f2fd' : 'transparent',
            color: isActive ? '#1976d2' : '#374151',
            borderRight: isActive ? '2px solid #1976d2' : 'none'
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
          onClick={() => {
            if (hasChildren) {
              toggleMenu(menu.id)
            }
          }}
        >
          {/* 图标 */}
          <span style={{
            flexShrink: 0,
            width: '20px',
            height: '20px',
            marginRight: '12px',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getMenuIcon(menu)}
          </span>
          
          {/* 菜单名称 */}
          {!collapsed && (
            <>
              {hasChildren ? (
                <span style={{
                  flex: 1,
                  fontSize: '14px',
                  fontWeight: '500'
                }}>{menu.title}</span>
              ) : (
                <Link 
                  to={menu.path || '#'} 
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    fontWeight: '500',
                    textDecoration: 'none',
                    color: 'inherit'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {menu.title}
                </Link>
              )}
              
              {/* 展开/收起图标 */}
              {hasChildren && (
                <span style={{
                  flexShrink: 0,
                  marginLeft: '8px'
                }}>
                  {isExpanded ? (
                    <ChevronDown style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <ChevronRight style={{ width: '16px', height: '16px' }} />
                  )}
                </span>
              )}
            </>
          )}
        </div>

        {/* 子菜单 */}
        {hasChildren && !collapsed && isExpanded && (
          <div style={{ marginTop: '4px' }}>
            {menu.children!.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        height: '100%'
      }}>
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{
          textAlign: 'center',
          color: '#dc2626'
        }}>
          <p style={{ fontSize: '14px' }}>菜单加载失败</p>
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '4px'
          }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <aside style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      borderRight: '1px solid #e5e7eb'
    }}>
      {/* 侧边栏头部 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {!collapsed && (
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: 0
            }}>在线考试系统</h2>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              style={{
                padding: '4px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <ChevronRight 
                style={{
                  width: '16px',
                  height: '16px',
                  transition: 'transform 0.2s',
                  transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)'
                }}
              />
            </button>
          )}
        </div>
      </div>

      {/* 菜单列表 */}
      <nav style={{
        padding: '16px',
        flex: 1,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 80px)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {menus.map(menu => renderMenuItem(menu))}
        </div>
      </nav>

      {/* 侧边栏底部 - 已隐藏版权信息 */}
    </aside>
  )
}

// 移动端菜单抽屉组件
interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const { menus, loading } = useMenuPermissions()
  const location = useLocation()

  // 检查菜单是否激活
  const isMenuActive = (menu: MenuItem): boolean => {
    return location.pathname === menu.path
  }

  // 获取菜单图标
  const getMenuIcon = (menu: MenuItem): React.ReactNode => {
    if (menu.icon) {
      return iconMap[menu.icon] || menu.icon
    }
    return iconMap['dashboard']
  }

  // 渲染移动端菜单项
  const renderMobileMenuItem = (menu: MenuItem) => {
    const isActive = isMenuActive(menu)
    
    return (
      <Link
        key={menu.id}
        to={menu.path}
        onClick={onClose}
        className={`
          flex items-center px-4 py-3 border-b border-gray-100 transition-colors
          ${isActive 
            ? 'bg-blue-50 text-blue-700' 
            : 'text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        <span className="w-6 h-6 mr-3 text-lg">
          {getMenuIcon(menu)}
        </span>
        <span className="text-sm font-medium">{menu.title}</span>
      </Link>
    )
  }

  if (!isOpen) return null

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* 侧边栏 */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50 md:hidden">
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">菜单</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 菜单列表 */}
        <nav className="overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            menus.map(menu => {
              // 只渲染顶级菜单，子菜单暂时不支持
              if (!menu.parent_id) {
                return renderMobileMenuItem(menu)
              }
              return null
            })
          )}
        </nav>
      </div>
    </>
  )
}