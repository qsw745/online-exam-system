import { api } from '@shared/api/http'

export interface UserDTO {
  id: number
  username: string
  real_name: string
  role: string
}

function pickArray<T = any>(resp: any, fb: T[] = []): T[] {
  const d = resp?.data
  if (Array.isArray(d?.users)) return d.users as T[]
  if (Array.isArray(d)) return d as T[]
  return fb
}

export const usersApi = {
  async list() {
    const resp = await api.get('/users')
    return pickArray<UserDTO>(resp, [])
  },
}
