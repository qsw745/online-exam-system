// features/settings/hooks/useUserSettings.ts
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserSettings } from '../../../shared/types/settings'
import { api } from '@shared/api/http'

// 轻量内联服务（避免缺失的 services/settings.service）
const settingsEndpoint = '/settings/me'
const settingsService = {
  async get(): Promise<UserSettings | null> {
    try {
      const r = await api.get<any>(settingsEndpoint)
      const d = (r as any)?.data ?? r
      // 兼容 { data: {...} } / 直接 {...}
      return (d?.data ?? d ?? null) as UserSettings | null
    } catch {
      return null
    }
  },
  async save(payload: UserSettings): Promise<boolean> {
    try {
      const r = await api.put<any>(settingsEndpoint, payload)
      // 兼容 { success } / axios 响应
      const ok = (r as any)?.success
      return ok !== false
    } catch {
      return false
    }
  },
}

const DEFAULTS: UserSettings = {
  notifications: { email: true, push: true, sound: true },
  privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
  appearance: { language: 'zh-CN' },
}

export function useUserSettings() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const { language, setLanguage, t } = useLanguage()

  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)

  // 初始加载
  const load = useCallback(async () => {
    setInitialLoading(true)
    try {
      if (user?.id) {
        const data = await settingsService.get()
        const merged = { ...DEFAULTS, ...(data ?? {}) }
        setSettings(merged)
        // 同步语言给全局
        if (merged.appearance?.language) setLanguage(merged.appearance.language)
      } else {
        // 未登录：使用本地语言回填
        const localLang = (localStorage.getItem('language') as any) || language || 'zh-CN'
        setSettings({ ...DEFAULTS, appearance: { language: localLang } })
        setLanguage(localLang)
      }
    } finally {
      setInitialLoading(false)
    }
  }, [user?.id, setLanguage, language])

  useEffect(() => {
    load()
  }, [load])

  const isDirty = useMemo(() => {
    // 简单对比（必要时可定制忽略字段）
    return (
      JSON.stringify(settings) !==
      JSON.stringify({
        ...DEFAULTS,
        ...settings,
      })
    )
  }, [settings])

  const save = useCallback(async () => {
    setLoading(true)
    try {
      if (user?.id) {
        const ok = await settingsService.save(settings)
        if (!ok) throw new Error('save failed')
      } else {
        // 未登录：只持久化语言
        localStorage.setItem('language', settings.appearance.language)
      }
      message.success(t('settings.success'))
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || t('settings.error'))
      throw e
    } finally {
      setLoading(false)
    }
  }, [settings, user?.id, message, t])

  const reset = useCallback(() => {
    setSettings(s => ({ ...DEFAULTS, appearance: { language: s.appearance.language } }))
  }, [])

  return {
    t,
    initialLoading,
    loading,
    settings,
    setSettings,
    save,
    reset,
    isDirty,
  }
}

export default useUserSettings
