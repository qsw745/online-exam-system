// apps/backend/src/modules/menus/domain/menu.model.ts

export interface Menu {
  id: number
  name: string
  title: string
  path: string | null
  component: string | null
  icon: string | null
  parent_id: number | null
  sort_order: number
  level: number
  is_hidden: boolean
  is_disabled: boolean
  is_system: boolean
  menu_type: 'menu' | 'button' | 'link'
  permission_code: string | null
  redirect: string | null
  meta: any | null
  created_at: string
  updated_at: string
}

export interface MenuTreeNode extends Menu {
  children: MenuTreeNode[]
}

export interface Role {
  id: number
  name: string
  code: string
  description: string | null
  sort_order: number
  is_system: boolean
  is_disabled: boolean
  created_at?: string
  updated_at?: string
}

export type CreateMenuRequest = {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number | null
  sort_order?: number | null
  is_hidden?: boolean
  is_disabled?: boolean
  menu_type?: 'menu' | 'button' | 'link'
  permission_code?: string
  redirect?: string
  meta?: any
  description?: string
}

export type UpdateMenuRequest = CreateMenuRequest & { id: number }

export type CreateRoleRequest = {
  name: string
  code: string
  description?: string
  sort_order?: number
  is_system?: boolean
}
export type UpdateRoleRequest = CreateRoleRequest & { id: number }

export type UserMenuPermission = {
  menu_id: number
  menu_name: string
  menu_title: string
  path: string | null
  component: string | null
  icon: string | null
  parent_id: number | null
  sort_order: number
  level: number
  menu_type: Menu['menu_type']
  permission_code: string | null
  redirect: string | null
  meta: any | null
  has_permission: boolean
  permission_source: 'admin' | 'role' | 'user' | 'deny' | 'none'
}
