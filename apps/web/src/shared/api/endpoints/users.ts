import { api } from '../core/httpClient'

/** 根据你的实际返回再完善字段 */
export interface UserDTO {
  id: number
  name: string
  username?: string
  email?: string
  role?: string
  status?: 'active' | 'disabled'
}

export const usersApi = {
  /** 当前用户 */
  getCurrentUser: () => api.get<UserDTO>('/users/me'),

  /** 更新当前用户资料 */
  updateProfile: (userData: Partial<UserDTO>) => api.put<UserDTO>('/users/me', userData),

  /** 列表（可分页） */
  list: (params?: { page?: number; limit?: number; search?: string; role?: string }) =>
    api.get<UserDTO[]>('/users', { params }),

  /** 获取全部（如果后端是分页，这里等同 list） */
  getAll: (params: { page: number; limit: number; search?: string; role?: string }) =>
    api.get<UserDTO[]>('/users', { params }),

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
