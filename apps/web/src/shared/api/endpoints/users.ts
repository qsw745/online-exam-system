import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

/** 前端用到的用户字段 */
export interface UserDTO {
  id: number
  name?: string
  username?: string
  email?: string
  role?: string
  status?: 'active' | 'disabled' | string
  orgId?: number | null
  created_at?: string
  // 兼容 org 列表返回里的字段
  org_id?: number | null
  org_name?: string | null
}

type ListParams = {
  page?: number
  limit?: number
  search?: string
  role?: string
  orgId?: number
  include_children?: boolean
}

/** 统一后的列表返回结构（页面只依赖这一种） */
export type UsersListResult = {
  users: UserDTO[]
  total: number
  page: number
  limit: number
}

/** 后端 /users 的分页返回（按你的后端实现） */
type RawUsersPage = {
  users: UserDTO[]
  total: number
  page: number
  limit: number
}

/** /orgs/:orgId/users 的分页返回 */
type OrgUsersList = {
  items: UserDTO[]
  total: number
  page: number
  limit: number
}

/** 在 endpoints 层把 ApiResult<T> 统一解包为 T；失败抛错 */
async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (isSuccess<T>(r)) return r.data
  throw new Error(getErr(r, '请求失败'))
}

export const usersApi = {
  /** 当前登录用户（保留旧风格，外部有用到 ApiResult 的解包逻辑） */
  getCurrentUser: () => api.get<UserDTO>('/users/me'),

  /** 更新当前用户资料（同上，保持 ApiResult） */
  updateProfile: (userData: Partial<UserDTO>) => api.put<UserDTO>('/users/me', userData),

  /**
   * 统一的用户列表
   * - 无 orgId：GET /users  -> { success: true, data: { users, total, page, limit } }
   * - 有 orgId：GET /orgs/:orgId/users -> { success: true, data: { items, total, page, limit } }
   * 返回统一结构：{ users, total, page, limit }
   */
  async list(params?: ListParams): Promise<UsersListResult> {
    const page = Number(params?.page ?? 1)
    const limit = Number(params?.limit ?? 10)

    if (params?.orgId) {
      const { orgId, ...rest } = params
      const d = await unwrap<OrgUsersList>(api.get<OrgUsersList>(`/orgs/${orgId}/users`, { params: rest }))
      return {
        users: (d.items || []).map((u: UserDTO) => ({ ...u, orgId: u.orgId ?? u.org_id ?? null })),
        total: Number(d.total ?? 0),
        page: Number(d.page ?? page),
        limit: Number(d.limit ?? limit),
      }
    }

    // 后端返回的示例：{ success: true, data: { users:[...], total, page, limit } }
    const d = await unwrap<RawUsersPage>(api.get<RawUsersPage>('/users', { params }))
    return {
      users: Array.isArray(d.users) ? d.users : [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? page),
      limit: Number(d.limit ?? limit),
    }
  },

  /** 获取全部（如果后端是分页，这里等同 list） */
  getAll: (params: ListParams) => usersApi.list(params),

  /** 下方保留旧风格（返回 ApiResult），兼容你现有的 hook 解包逻辑 */
  getById: (id: number) => api.get<UserDTO>(`/users/${id}`),

  update: (id: string | number, userData: Partial<UserDTO>) => api.put<UserDTO>(`/users/${id}`, userData),

  delete: (id: string | number) => api.delete<void>(`/users/${id}`),

  updateStatus: (id: string | number, status: 'active' | 'disabled') =>
    api.put<void>(`/users/${id}/status`, { status }),

  resetPassword: (id: string | number) => api.put<void>(`/users/${id}/reset-password`, {}),
}

/** 兼容旧命名（如代码里还出现 import { users } ...） */
export const users = usersApi
export type { UserDTO as UsersItem }
