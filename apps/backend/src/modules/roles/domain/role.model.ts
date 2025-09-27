export interface Role {
    id: number
    org_id: number | null // ⭐ 新增：所属机构；为 null 表示“全局角色”
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
    org_id?: number | null // ⭐ 新增：可传入，用于按机构创建
}

export interface UpdateRoleRequest {
    id: number
    name?: string
    code?: string
    description?: string
    sort_order?: number
    is_system?: boolean
    is_disabled?: boolean
    org_id?: number | null // 不建议修改；若要迁移角色，可用
}
