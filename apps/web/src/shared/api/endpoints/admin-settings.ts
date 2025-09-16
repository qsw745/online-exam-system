import { api } from '../core/httpClient'
import type { SystemSettings } from '@/shared/types/admin-settings'
import type { ApiResult } from '../core/types'

export const adminSettingsApi = {
  async get(): Promise<SystemSettings> {
    const res = await api.get<SystemSettings>('/admin/settings')
    if ((res as ApiResult<SystemSettings>).success) {
      return (res as any).data as SystemSettings
    }
    throw new Error((res as any).error || '加载系统设置失败')
  },
  async getPublic(): Promise<SystemSettings> {
    const res = await api.get<SystemSettings>('/public/settings')
    if ((res as ApiResult<SystemSettings>).success) {
      return (res as any).data as SystemSettings
    }
    throw new Error((res as any).error || '加载系统设置失败')
  },

  async update(payload: Partial<SystemSettings>): Promise<void> {
    const res = await api.put<null>('/admin/settings', payload)
    if (!(res as any).success) {
      throw new Error((res as any).error || '保存系统设置失败')
    }
  },
}
