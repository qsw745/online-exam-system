// src/shared/hooks/useMenuPermissions.ts
// 这个文件现在只是为了向后兼容，实际功能已经移到 MenuPermissionContext
import React from 'react'
import { useMenuPermissions as useMenuPermissionsFromContext } from '../contexts/MenuPermissionContext'
import type { MenuItem } from '../contexts/MenuPermissionContext'

export interface UserMenuPermissions {
  menus: MenuItem[]
  permissions: string[]
}

// 导出 MenuItem 类型以保持向后兼容
export type { MenuItem }

// 重新导出 useMenuPermissions 钩子
export function useMenuPermissions() {
  return useMenuPermissionsFromContext()
}

export function withMenuPermission<T extends object>(Component: React.ComponentType<T>, requiredPath: string) {
  return function PermissionWrappedComponent(props: T) {
    // 这里仅做占位以保持兼容，真实的权限控制在路由/菜单侧完成
    return React.createElement(Component, props)
  }
}

export default useMenuPermissions
