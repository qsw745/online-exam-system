import { api } from '@shared/api/http'
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react'

import { useAuth } from './AuthContext'

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
  menu_type: 'menu' | 'button' | 'link' | 'page' // 你的表里有 page，补上更稳
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
      const res = await api.get<MenuItem[]>(`/menu/users/${user.id}/menus`)
      if (!res.success) {
        const msg = 'error' in res ? res.error : '获取菜单权限失败'
        throw new Error(msg)
      }

      // res.data 可能就是数组，也可能是 { data:[] } / { items:[] } / { list:[] }
      const payload: any = res.data
      const menuData: MenuItem[] = Array.isArray(payload)
        ? payload
        : payload?.data ?? payload?.items ?? payload?.list ?? []

      setMenus(menuData)

      // 提取权限代码
      const permissionCodes = extractPermissions(menuData)
      setPermissions(permissionCodes)
      // console.log(`成功获取 ${menuData.length} 个菜单，${permissionCodes.length} 个权限`)
    } catch (err: any) {
      console.error('获取用户菜单失败:', err)
      const errorMessage = err?.message || '获取菜单权限失败'
      setError(errorMessage)
      setMenus([])
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }

  const extractPermissions = (menuTree: MenuItem[]): string[] => {
    const list: string[] = []
    const walk = (items: MenuItem[]) => {
      items.forEach(it => {
        if (it.permission_code) list.push(it.permission_code)
        if (it.children?.length) walk(it.children)
      })
    }
    walk(menuTree)
    return list
  }

  const hasMenuPermission = (path: string): boolean => {
    if (!path) return true
    const find = (items: MenuItem[], target: string): boolean =>
      items.some(it => it.path === target || (it.children?.length ? find(it.children, target) : false))
    return find(menus, path)
  }

  const hasOperationPermission = (operation: string): boolean => permissions.includes(operation)

  const flattenMenus = (menuTree: MenuItem[]): MenuItem[] => {
    const result: MenuItem[] = []
    const walk = (items: MenuItem[]) => {
      items.forEach(it => {
        result.push(it)
        if (it.children?.length) walk(it.children)
      })
    }
    walk(menuTree)
    return result
  }

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
    refetch: fetchUserMenus,
  }

  return <MenuPermissionContext.Provider value={value}>{children}</MenuPermissionContext.Provider>
}

export function useMenuPermissions(): MenuPermissionContextType {
  const context = useContext(MenuPermissionContext)
  if (context === undefined) {
    throw new Error('useMenuPermissions must be used within a MenuPermissionProvider')
  }
  return context
}

export function withMenuPermission<T extends object>(Component: React.ComponentType<T>, _requiredPath: string) {
  return function PermissionWrappedComponent(props: T) {
    return React.createElement(Component, props)
  }
}
