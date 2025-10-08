import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { menuApi } from '@/shared/api/endpoints/menu'
import { useAuth } from './AuthContext'

export interface MenuItem {
  id: number
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number | null
  sort_order: number
  level: number
  is_hidden: boolean
  is_disabled: boolean
  is_system: boolean
  menu_type: 'menu' | 'button' | 'link' | 'page'
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

function getCurrentOrgId(): number | undefined {
  const raw = localStorage.getItem('currentOrgId') || localStorage.getItem('orgId')
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export function MenuPermissionProvider({ children }: MenuPermissionProviderProps) {
  const { user } = useAuth()
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
const fetchUserMenus = async () => {
   if (!user?.id) {
     setMenus([])
     setPermissions([])
     setError(null)
     return
   }
  setLoading(true)
  setError(null)
  try {
    const orgId = (user as any)?.orgId ?? (user as any)?.primary_org_id ?? getCurrentOrgId()
    const data = await menuApi.userMenus(Number(user.id), orgId, {
      strict: true, // ✅ 用严格模式
      nocache: true, // ✅ 第一次强刷后端缓存（只在你怀疑后端缓存脏时用一次）
      transport: 'header', // ✅ 参数走请求头，不占 URL
    })
    const menuTree: MenuItem[] = Array.isArray(data) ? (data as any) : (data as any)?.data ?? []
    setMenus(menuTree)
    setPermissions(extractPermissions(menuTree))
  } catch (err: any) {
    console.error('获取用户菜单失败:', err)
    setMenus([])
    setPermissions([])
    setError(err?.message || '获取菜单权限失败')
  } finally {
    setLoading(false)
  }
}



  useEffect(() => {
    // 只在 user.id/当前 org 变化时拉一次
    fetchUserMenus()
    // 监听本地 orgId 变更（切组织时刷新）
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'currentOrgId' || e.key === 'orgId') fetchUserMenus()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const hasMenuPermission = (path: string): boolean => {
    if (!path) return true
    const find = (items: MenuItem[], target: string): boolean =>
      items.some(it => it.path === target || (it.children?.length ? find(it.children, target) : false))
    return find(menus, path)
  }

  const hasOperationPermission = (operation: string): boolean => permissions.includes(operation)

  const flatMenus = useMemo(() => {
    const result: MenuItem[] = []
    const walk = (items: MenuItem[]) => {
      items.forEach(it => {
        result.push(it)
        if (it.children?.length) walk(it.children)
      })
    }
    walk(menus)
    return result
  }, [menus])

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
  const ctx = useContext(MenuPermissionContext)
  if (!ctx) throw new Error('useMenuPermissions must be used within a MenuPermissionProvider')
  return ctx
}
