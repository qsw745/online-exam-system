import { useAuth } from '@/shared/contexts/AuthContext'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { App } from 'antd'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { UserSettings } from '@/shared/types/settings'
import { api } from '@/shared/api/http'

const DEFAULTS: UserSettings = {
  notifications: { email: true, push: true, sound: true },
  privacy: { profile_visibility: 'public', show_activity: true, show_results: true },
  appearance: { language: 'zh-CN' },
}
const bool = (value: unknown, fallback: boolean) => value == null ? fallback : [true, 1, '1', 'true'].includes(value as never)
export function normalizeUserSettings(data: any, language: 'zh-CN' | 'en-US'): UserSettings {
  return {
    ...data,
    notifications: { email: bool(data?.notifications?.email, true), push: bool(data?.notifications?.push, true), sound: bool(data?.notifications?.sound, true) },
    privacy: { profile_visibility: data?.privacy?.profile_visibility === 'private' ? 'private' : 'public',
      show_activity: bool(data?.privacy?.show_activity, true), show_results: bool(data?.privacy?.show_results, true) },
    appearance: { language: ['zh-CN', 'en-US'].includes(data?.appearance?.language) ? data.appearance.language : language },
  }
}

export function useUserSettings() {
  const { message } = App.useApp()
  const { user } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings>(() => normalizeUserSettings(DEFAULTS, language))
  const [initial, setInitial] = useState(settings)
  const [retry, setRetry] = useState(0)
  const generation = useRef(0)
  const saveLock = useRef(false)
  const languageRef = useRef(language)
  useLayoutEffect(() => { languageRef.current = language }, [language])
  useLayoutEffect(() => {
    generation.current += 1
    saveLock.current = false
    return () => { generation.current += 1 }
  }, [user?.id])

  useEffect(() => {
    let active = true
    const load = async () => {
      setInitialLoading(true)
      setLoading(false)
      setError(null)
      setSaveError(null)
      try {
        const result = user?.id ? await api.get<UserSettings>('/users/settings') : { success: true, data: null }
        if (!active) return
        if (!result.success) throw new Error('error' in result ? result.error : '设置加载失败')
        const next = normalizeUserSettings(result.data, languageRef.current)
        setSettings(next)
        setInitial(next)
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : '设置加载失败，请重试')
      } finally { if (active) setInitialLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [user?.id, retry])

  useEffect(() => {
    if (!initialLoading && !error && settings.appearance.language !== language) setLanguage(settings.appearance.language)
  }, [initialLoading, error, settings.appearance.language, language, setLanguage])

  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(initial), [settings, initial])
  const save = async () => {
    if (saveLock.current || initialLoading || error || !isDirty) return
    const version = generation.current
    const snapshot = settings
    saveLock.current = true
    setLoading(true)
    setSaveError(null)
    try {
      if (user?.id) {
        const result = await api.post('/users/settings', snapshot)
        if (!result.success) throw new Error(result.error || '设置保存失败，请重试')
      } else localStorage.setItem('language', snapshot.appearance.language)
      if (version !== generation.current) return
      setInitial(snapshot)
      message.success(t('settings.success'))
    } catch (error) {
      if (version === generation.current) setSaveError(error instanceof Error ? error.message : '设置保存失败，请重试')
    } finally {
      if (version === generation.current) { saveLock.current = false; setLoading(false) }
    }
  }
  const reset = useCallback(() => { setSettings(initial); setSaveError(null) }, [initial])
  return { t, initialLoading, loading, error, saveError, retry: () => setRetry(value => value + 1), settings, setSettings, save, reset, isDirty }
}
export default useUserSettings
