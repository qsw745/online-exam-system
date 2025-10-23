import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type UserGender = '男' | '女' | '保密'

export interface UserDTO {
  id: number
  name?: string
  username?: string
  email?: string | null
  role?: string
  status?: 'active' | 'disabled' | string
  orgId?: number | null
  created_at?: string
  org_id?: number | null
  org_name?: string | null
  nickname?: string | null
  phone?: string | null
  gender?: UserGender | null
  remark?: string | null
}

type ListParams = {
  page?: number
  limit?: number
  search?: string
  role?: string
  /** ✅ 新：直接传 orgId 给 /users */
  orgId?: number
  include_children?: boolean
}

export type UsersListResult = {
  users: UserDTO[]
  total: number
  page: number
  limit: number
}

type RawUsersPage = {
  users: UserDTO[]
  total: number
  page: number
  limit: number
}

type OrgUsersList = {
  items: UserDTO[]
  total: number
  page: number
  limit: number
}

export type CreateUserPayload = {
  
  nickname: string
  password: string
  phone?: string
  email?: string
  gender?: UserGender
  org_id?: number
  status: 'active' | 'disabled'
  remark?: string
}

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const usersApi = {
  getCurrentUser: () => api.get<UserDTO>('/users/me'),
  updateProfile: (userData: Partial<UserDTO>) => api.put<UserDTO>('/users/me', userData),

  create: (payload: CreateUserPayload) => unwrap<UserDTO>(api.post<UserDTO>('/users', payload)),

  /** ✅ 统一改为请求 /users，组织过滤用 ?orgId=、?include_children= */
  async list(params?: ListParams): Promise<UsersListResult> {
    const page = Number(params?.page ?? 1)
    const limit = Number(params?.limit ?? 10)

    const d = await unwrap<RawUsersPage | OrgUsersList>(api.get<RawUsersPage | OrgUsersList>('/users', { params }))

    // 后端两种返回：/users 直接分页 {users,total,page,limit}
    // 或（历史兼容）组织过滤时也返回 {users,total,page,limit}（已在后端对齐）
    if ('users' in d) {
      return {
        users: Array.isArray(d.users) ? d.users : [],
        total: Number((d as any).total ?? 0),
        page: Number((d as any).page ?? page),
        limit: Number((d as any).limit ?? limit),
      }
    }

    // 极少数情况下，如果后端返回 {items,total,...}，兜底处理成统一结构
    const items = (d as any).items ?? []
    return {
      users: items,
      total: Number((d as any).total ?? 0),
      page: Number((d as any).page ?? page),
      limit: Number((d as any).limit ?? limit),
    }
  },

  getAll: (params: ListParams) => usersApi.list(params),
  getById: (id: number) => api.get<UserDTO>(`/users/${id}`),
  update: (id: string | number, userData: Partial<UserDTO>) => api.put<UserDTO>(`/users/${id}`, userData),
  delete: (id: string | number) => api.delete<void>(`/users/${id}`),

  updateStatus: (id: string | number, status: 'active' | 'disabled') =>
    api.put<void>(`/users/${id}/status`, { status }),

  resetPassword: (id: string | number, password?: string) =>
    api.put<void>(`/users/${id}/reset-password`, password ? { password } : {}),
  batchDelete: (ids: number[]) => api.post<{ deleted: number; skipped: number[] }>('/users/batch-delete', { ids }),
}

export const users = usersApi
export type { UserDTO as UsersItem }
