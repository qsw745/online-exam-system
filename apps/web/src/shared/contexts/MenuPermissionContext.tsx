import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { menuApi } from '@/shared/api/endpoints/menu'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'

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
  const { t } = useLanguage()
  const [rawMenus, setRawMenus] = useState<MenuItem[]>([])
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
  const inferMenuKey = (item: MenuItem): string | null => {
    const metaKey = item?.meta?.i18nKey
    if (typeof metaKey === 'string' && metaKey.trim()) return metaKey.trim()
    if (item?.name) return `menus.${item.name}`
    return null
  }

  const translateMenuTitle = useCallback(
    (item: MenuItem): string => {
      const key = inferMenuKey(item)
      if (key) return t(key, item.title)
      return item.title
    },
    [t]
  )

  const translateMenuTree = useCallback(
    (nodes: MenuItem[] = []): MenuItem[] =>
      nodes.map(node => {
        const translatedChildren = node.children?.length ? translateMenuTree(node.children) : undefined
        return {
          ...node,
          title: translateMenuTitle(node),
          children: translatedChildren,
        }
      }),
    [translateMenuTitle]
  )

  const menus = useMemo(() => translateMenuTree(rawMenus), [rawMenus, translateMenuTree])
const fetchUserMenus = async () => {
  if (!user?.id) {
    setRawMenus([])
    setPermissions([])
    setError(null)
    return
  }
  setLoading(true)
  setError(null)
  try {
    // 统一走"按用户角色过滤"的菜单树——后端对任意角色（含管理员=全部授权）都返回正确结果。
    // 不能按前端的 email/role/localStorage 判断管理员后改走 functionsTree() 全量，
    // 否则残留的 USER_ROLE 等会让普通用户误拿到全部模块（越权可见）。
    const orgId = (user as any)?.orgId ?? (user as any)?.primary_org_id ?? getCurrentOrgId()
    const data = await menuApi.userMenus(Number(user.id), orgId, {
      strict: true,
      nocache: true, // 首次强刷
      transport: 'header',
    })
    const menuTree: MenuItem[] = Array.isArray(data) ? (data as any) : (data as any)?.data ?? []

    setRawMenus(menuTree)
    setPermissions(extractPermissions(menuTree))
  } catch (err: any) {
    console.error('获取用户菜单失败:', err)
    setRawMenus([])
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
