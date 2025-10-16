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

export interface CreateRoleRequest {
  name: string
  code?: string
  description?: string
  sort_order?: number
  is_system?: boolean
  is_disabled?: number | boolean
}

export interface UpdateRoleRequest {
  id: number
  name?: string
  code?: string
  description?: string
  sort_order?: number
  is_system?: boolean
  is_disabled?: boolean
}
