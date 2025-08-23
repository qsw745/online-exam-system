import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
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

export interface UserMenuPermissions {
  menus: MenuItem[]
  permissions: string[]
}

export function useMenuPermissions() {
  const { user } = useAuth()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchUserMenus()
    }
  }, [user?.id])

  const fetchUserMenus = async () => {
    if (!user?.id) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await api.get(`/menu/users/${user.id}/menus`)
      
      // 检查响应数据格式
      if (Array.isArray(response.data)) {
        // 直接返回菜单数组的格式
        setMenus(response.data)
        // 提取权限代码
        const permissionCodes = extractPermissions(response.data)
        setPermissions(permissionCodes)
      } else if (response.data.success) {
        // 包含success字段的格式
        setMenus(response.data.data || [])
        // 提取权限代码
        const permissionCodes = extractPermissions(response.data.data || [])
        setPermissions(permissionCodes)
      } else {
        setError('获取菜单权限失败：数据格式不正确')
      }
    } catch (err: any) {
      console.error('获取用户菜单失败:', err)
      setError(err.response?.data?.message || err.message || '获取菜单权限失败')
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

  const buildMenuTree = (flatMenus: MenuItem[]): MenuItem[] => {
    return flatMenus // 后端已经返回树形结构
  }
  
  const flatMenus = flattenMenus(menus)

  return {
    menus,
    permissions,
    loading,
    error,
    hasMenuPermission,
    hasOperationPermission,
    buildMenuTree,
    flatMenus,
    refetch: fetchUserMenus
  }
}

export function withMenuPermission<T extends object>(
  Component: React.ComponentType<T>,
  requiredPath: string
) {
  return function PermissionWrappedComponent(props: T) {
    return React.createElement(Component, props)
  }
}