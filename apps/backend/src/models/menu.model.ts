// 菜单管理相关的数据模型

export interface Menu {
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
  description?: string
  created_at: string
  updated_at: string
  children?: Menu[]
}

export interface Role {
  id: number
  name: string
  code: string
  description?: string | null
  is_system: 0 | 1 | boolean
  is_disabled: 0 | 1 | boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: number
  user_id: number
  role_id: number
  created_at: string
}

export interface RoleMenu {
  id: number
  role_id: number
  menu_id: number
  created_at: string
}

export interface UserMenu {
  id: number
  user_id: number
  menu_id: number
  permission_type: 'grant' | 'deny'
  created_at: string
}

export interface CreateMenuRequest {
  name: string
  title: string
  path?: string
  component?: string
  icon?: string
  parent_id?: number
  sort_order?: number
  is_hidden?: boolean
  is_disabled?: boolean
  menu_type?: 'menu' | 'button' | 'link'
  permission_code?: string
  redirect?: string
  meta?: any
  description?: string
}

export interface UpdateMenuRequest extends Partial<CreateMenuRequest> {
  id: number
}

export interface CreateRoleRequest {
  name: string
  code: string // 新增：必填
  description?: string
  sort_order?: number
  is_system?: boolean
}

export interface UpdateRoleRequest {
  id: number
  name?: string
  code?: string // 可选更新
  description?: string
  sort_order?: number
  is_system?: boolean
  is_disabled?: boolean
}

export interface AssignRoleMenuRequest {
  role_id: number
  menu_ids: number[]
}

export interface AssignUserRoleRequest {
  user_id: number
  role_ids: number[]
}

export interface AssignUserMenuRequest {
  user_id: number
  menu_id: number
  permission_type: 'grant' | 'deny'
}

export interface MenuTreeNode extends Menu {
  children: MenuTreeNode[]
}

export interface UserMenuPermission {
  menu_id: number
  menu_name: string
  menu_title: string
  path: string | null
  component: string | null
  icon: string | null
  parent_id: number | null
  sort_order: number
  level: number
  menu_type: 'menu' | 'button' | 'link' | string
  permission_code?: string | null
  redirect?: string | null
  meta?: any
  has_permission: boolean
  permission_source: 'admin' | 'role' | 'user' | 'deny' | 'none'
}
