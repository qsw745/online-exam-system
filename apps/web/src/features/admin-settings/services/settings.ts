// features/admin-settings/services/settings.ts
import { api } from '@shared/api/http'
import type { SystemSettings } from '../types'

export const settingsService = {
  async get(): Promise<SystemSettings> {
    const res = await api.get('/admin/settings') // 你现在注释掉的接口
    // 服务器不返回 defaultPassword
    return res.data as SystemSettings
  },
  async update(payload: SystemSettings) {
    // 后端可忽略空的 defaultPassword 字段（表示不修改）
    return api.put('/admin/settings', payload)
  },
}
