import { api } from '../core/httpClient'
import { getAccessToken } from '../core/storage'
import type { ApiSuccess } from '../core/types'

export const settingsApi = {
  async get() {
    const token = getAccessToken()
    if (!token) {
      const base = {
        notifications: { email: true, push: true, sound: true },
        privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
        appearance: { language: (localStorage.getItem('language') as string) || 'zh-CN' },
      }
      const stored = localStorage.getItem('userSettings')
      if (stored) {
        try {
          const p = JSON.parse(stored)
          return {
            success: true,
            data: {
              notifications: { ...base.notifications, ...p.notifications },
              privacy: { ...base.privacy, ...p.privacy },
              appearance: { ...base.appearance, ...p.appearance },
            },
          } as ApiSuccess
        } catch {}
      }
      return { success: true, data: base } as ApiSuccess
    }
    const res = await api.get('/users/settings')
    if (res.success && res.data) localStorage.setItem('userSettings', JSON.stringify(res.data))
    return res
  },

  async save(settingsData: any) {
    localStorage.setItem('userSettings', JSON.stringify(settingsData))
    const token = getAccessToken()
    if (!token) {
      if (settingsData?.appearance?.language) localStorage.setItem('language', settingsData.appearance.language)
      return { success: true, data: settingsData } as ApiSuccess
    }
    const res = await api.post('/users/settings', settingsData)
    return res.success ? res : ({ success: true, data: settingsData } as ApiSuccess)
  },
}
