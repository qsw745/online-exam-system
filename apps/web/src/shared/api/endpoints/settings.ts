// --- 系统设置（Admin） & 个人设置（User）端点统一放这里 ---
// 如你的别名不同，请把 "@/..." 改成你项目里的别名

import { api } from '@/shared/api/core/httpClient'
import { getAccessToken } from '@/shared/api/core/storage'
import type { SystemSettings } from '@/shared/types/admin-settings'

// ========= 个人设置（User Preferences） =========
// 结构示例：与现有的 notifications/privacy/appearance 一致
export type UserSettings = {
  notifications: { email: boolean; push: boolean; sound: boolean }
  privacy: { profile_visibility: 'public' | 'private'; show_activity: boolean; show_results: boolean }
  appearance: { language: string }
}

// 个人设置 API（带本地兜底 & 无 token 时走 localStorage）
export const userSettingsApi = {
  async get(): Promise<UserSettings> {
    const base: UserSettings = {
      notifications: { email: true, push: true, sound: true },
      privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
      appearance: { language: (localStorage.getItem('language') as string) || 'zh-CN' },
    }

    const token = getAccessToken()
    // 无 token：只用本地存储兜底
    if (!token) {
      const stored = localStorage.getItem('userSettings')
      if (stored) {
        try {
          const p = JSON.parse(stored)
          return {
            notifications: { ...base.notifications, ...(p?.notifications || {}) },
            privacy: { ...base.privacy, ...(p?.privacy || {}) },
            appearance: { ...base.appearance, ...(p?.appearance || {}) },
          } as UserSettings
        } catch {
          /* ignore */
        }
      }
      return base
    }

    // 有 token：请求服务端
    const res: any = await api.get<UserSettings>('/users/settings')
    const data: UserSettings = res?.data ?? res // 兼容 normalize 返回 或 直出
    if (data) localStorage.setItem('userSettings', JSON.stringify(data))
    return data || base
  },

  async save(payload: UserSettings): Promise<UserSettings> {
    // 本地持久化
    localStorage.setItem('userSettings', JSON.stringify(payload))
    if (payload?.appearance?.language) {
      localStorage.setItem('language', payload.appearance.language)
    }

    const token = getAccessToken()
    if (!token) return payload

    // 有 token：提交服务端
    const res: any = await api.post<UserSettings>('/users/settings', payload)
    const data: UserSettings = res?.data ?? payload
    return data
  },
}

// ========= 系统设置（Admin System Settings） =========
// 说明：这是 Admin 设置页面使用的 API（useSettings Hook 会用这个）
const ADMIN_BASE = '/admin/settings'

export const settingsApi = {
  async get(): Promise<SystemSettings> {
    const res: any = await api.get<SystemSettings>(ADMIN_BASE)
    // 兼容 normalize 返回 {success,data} 或直接数据
    return (res && 'data' in res ? res.data : res) as SystemSettings
  },

  async update(payload: SystemSettings): Promise<void> {
    await api.put<SystemSettings>(ADMIN_BASE, payload)
  },
}
