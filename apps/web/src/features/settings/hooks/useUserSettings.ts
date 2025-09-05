// features/settings/hooks/useUserSettings.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import { settingsService } from '../services/settings.service'
import type { UserSettings } from '../types/settings'
import { useAuth } from '@shared/contexts/AuthContext'
import { useLanguage } from '@shared/contexts/LanguageContext'

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
    // 只对比除语言外变化？这里全部比较
    return (
      JSON.stringify(settings) !==
      JSON.stringify({
        ...DEFAULTS,
        // 注意：如果后端返回时某些字段缺省，DEFAULTS 可确保结构一致
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
