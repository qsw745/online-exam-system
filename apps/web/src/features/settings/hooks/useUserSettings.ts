// features/settings/hooks/useUserSettings.ts
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { UserSettings } from '@/shared/types/settings'
import { api } from '@/shared/api/http'

// 轻量内联服务
const settingsEndpoint = 'users/settings'
const settingsService = {
  async get(): Promise<UserSettings | null> {
    try {
      const r = await api.get<any>(settingsEndpoint)
      const d = (r as any)?.data ?? r
      return (d?.data ?? d ?? null) as UserSettings | null
    } catch {
      return null
    }
  },
  async save(payload: UserSettings): Promise<boolean> {
    try {
      const r = await api.put<any>(settingsEndpoint, payload)
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

  // 当前设置 & 原始设置
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)
  const [initial, setInitial] = useState<UserSettings>(DEFAULTS)

  // 初始加载
  const load = useCallback(async () => {
    setInitialLoading(true)
    try {
      if (user?.id) {
        const data = await settingsService.get()
        const merged = { ...DEFAULTS, ...(data ?? {}) }
        setSettings(merged)
        setInitial(merged)
        if (merged.appearance?.language) setLanguage(merged.appearance.language)
      } else {
        const localLang = (localStorage.getItem('language') as any) || language || 'zh-CN'
        const merged = { ...DEFAULTS, appearance: { language: localLang } }
        setSettings(merged)
        setInitial(merged)
        setLanguage(localLang)
      }
    } finally {
      setInitialLoading(false)
    }
  }, [user?.id, setLanguage, language])

  useEffect(() => {
    load()
  }, [load])

  // 语言选择变化 → 立即生效 & 持久化 & 通知 antd 切换 locale
  useEffect(() => {
    const lang = settings?.appearance?.language || 'zh-CN'
    setLanguage(lang)
    try {
      localStorage.setItem('language', lang)
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-language-changed', { detail: lang }))
      document.documentElement.lang = lang
    }
  }, [settings?.appearance?.language, setLanguage])

  // 和“原始值”做深比较
  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(initial), [settings, initial])

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
      setInitial(settings) // ✅ 保存成功后刷新基准
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
    // 恢复到“当前初始值”，而不是 DEFAULTS
    setSettings(initial)
  }, [initial])

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
