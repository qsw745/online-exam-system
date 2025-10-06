// features/settings/hooks/useUserSettings.ts
import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UserSettings } from '@/shared/types/settings'
import { api } from '@/shared/api/http'

// 仅走用户偏好端点，不触发 /admin/settings
const settingsEndpoint = '/users/settings'

const settingsService = {
  async get(): Promise<UserSettings | null> {
    try {
      const r = await api.get<any>(settingsEndpoint)
      const d = (r as any)?.data ?? r // 兼容 {success,data} 或直出
      return (d?.data ?? d ?? null) as UserSettings | null
    } catch {
      return null
    }
  },
  async save(payload: UserSettings): Promise<boolean> {
    try {
      // 统一在点击“保存”时才请求
      const r = await api.post<any>(settingsEndpoint, payload)
      return (r as any)?.success !== false
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
  const [initial, setInitial] = useState<UserSettings>(DEFAULTS)

  // —— 防止 React 18 StrictMode 开发环境下 effect 执行两次而重复请求
  const loadedOnceRef = useRef(false)

  // 初始加载（不在这里保存语言到服务端）
  const load = useCallback(async () => {
    if (loadedOnceRef.current) return
    loadedOnceRef.current = true

    setInitialLoading(true)
    try {
      if (user?.id) {
        const data = await settingsService.get()
        const merged = { ...DEFAULTS, ...(data ?? {}) }
        setSettings(merged)
        setInitial(merged)
      } else {
        const localLang = (localStorage.getItem('language') as any) || 'zh-CN'
        const merged = { ...DEFAULTS, appearance: { language: localLang } }
        setSettings(merged)
        setInitial(merged)
      }
    } finally {
      setInitialLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  // 语言切换：只本地应用，不请求后端（避免你看到的多次请求）
  useEffect(() => {
    const lang = settings?.appearance?.language || 'zh-CN'
    if (lang !== language) {
      setLanguage(lang) // 切 UI
    }
    try {
      localStorage.setItem('language', lang) // 本地记忆
    } catch {}
    if (typeof window !== 'undefined') {
      // 通知其他需要响应语言变化的地方（不发请求）
      window.dispatchEvent(new CustomEvent('app-language-changed', { detail: lang }))
      document.documentElement.lang = lang
    }
  }, [settings?.appearance?.language, language, setLanguage])

  // “是否修改过”判断
  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(initial), [settings, initial])

  // 只有点击“保存”才请求后端
  const save = useCallback(async () => {
    setLoading(true)
    try {
      if (user?.id) {
        const ok = await settingsService.save(settings)
        if (!ok) throw new Error('save failed')
      } else {
        // 未登录：只落本地语言，不请求
        localStorage.setItem('language', settings.appearance.language)
      }
      setInitial(settings) // 保存成功后刷新基准
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
    setSettings(initial)
  }, [initial])

  return {
    t,
    initialLoading,
    loading,
    settings,
    setSettings,
    save, // ← 只在这里才会请求
    reset,
    isDirty,
  }
}

export default useUserSettings
