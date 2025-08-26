import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'

export interface MenuItem {
  id: number
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number
  sort_order: number
  level: number
  is_hidden: boolean
  is_disabled: boolean
  is_system: boolean
  menu_type: 'menu' | 'button' | 'link'
  permission_code?: string
  redirect?: string
  meta?: any
  children?: MenuItem[]
}

interface MenuPermissionContextType {
  menus: MenuItem[]
  permissions: string[]
  loading: boolean
  error: string | null
  hasMenuPermission: (path: string) => boolean
  hasOperationPermission: (operation: string) => boolean
  flatMenus: MenuItem[]
  refetch: () => Promise<void>
}

const MenuPermissionContext = createContext<MenuPermissionContextType | undefined>(undefined)

interface MenuPermissionProviderProps {
  children: ReactNode
}

export function MenuPermissionProvider({ children }: MenuPermissionProviderProps) {
  const { user } = useAuth()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUserMenus = async () => {
    if (!user?.id) {
      setMenus([])
      setPermissions([])
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      console.log(`正在获取用户 ${user.id} 的菜单权限...`)
      const response = await api.get(`/menu/users/${user.id}/menus`)
      
      // 检查响应数据格式
      let menuData: MenuItem[] = []
      if (Array.isArray(response.data)) {
        // 直接返回菜单数组的格式
        menuData = response.data
      } else if (response.data.success) {
        // 包含success字段的格式
        menuData = response.data.data || []
      } else {
        throw new Error('获取菜单权限失败：数据格式不正确')
      }
      
      setMenus(menuData)
      // 提取权限代码
      const permissionCodes = extractPermissions(menuData)
      setPermissions(permissionCodes)
      
      console.log(`成功获取 ${menuData.length} 个菜单，${permissionCodes.length} 个权限`)
    } catch (err: any) {
      console.error('获取用户菜单失败:', err)
      const errorMessage = err.response?.data?.message || err.message || '获取菜单权限失败'
      setError(errorMessage)
      setMenus([])
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }

  const extractPermissions = (menuTree: MenuItem[]): string[] => {
    const permissions: string[] = []
    
    const traverse = (items: MenuItem[]) => {
      items.forEach(item => {
        if (item.permission_code) {
          permissions.push(item.permission_code)
        }
        if (item.children) {
          traverse(item.children)
        }
      })
    }
    
    traverse(menuTree)
    return permissions
  }

  const hasMenuPermission = (path: string): boolean => {
    if (!path) return true
    
    const findMenuByPath = (items: MenuItem[], targetPath: string): boolean => {
      return items.some(item => {
        if (item.path === targetPath) return true
        if (item.children) {
          return findMenuByPath(item.children, targetPath)
        }
        return false
      })
    }
    
    return findMenuByPath(menus, path)
  }

  const hasOperationPermission = (operation: string): boolean => {
    return permissions.includes(operation)
  }
  
  const flattenMenus = (menuTree: MenuItem[]): MenuItem[] => {
    const result: MenuItem[] = []
    
    const traverse = (items: MenuItem[]) => {
      items.forEach(item => {
        result.push(item)
        if (item.children) {
          traverse(item.children)
        }
      })
    }
    
    traverse(menuTree)
    return result
  }

  // 当用户变化时重新获取菜单
  useEffect(() => {
    fetchUserMenus()
  }, [user?.id])

  const flatMenus = flattenMenus(menus)

  const value: MenuPermissionContextType = {
    menus,
    permissions,
    loading,
    error,
    hasMenuPermission,
    hasOperationPermission,
    flatMenus,
    refetch: fetchUserMenus
  }

  return (
    <MenuPermissionContext.Provider value={value}>
      {children}
    </MenuPermissionContext.Provider>
  )
}

export function useMenuPermissions(): MenuPermissionContextType {
  const context = useContext(MenuPermissionContext)
  if (context === undefined) {
    throw new Error('useMenuPermissions must be used within a MenuPermissionProvider')
  }
  return context
}

export function withMenuPermission<T extends object>(
  Component: React.ComponentType<T>,
  requiredPath: string
) {
  return function PermissionWrappedComponent(props: T) {
    return React.createElement(Component, props)
  }
}