// apps/web/src/features/admin-settings/hooks/useSettings.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SystemSettings } from '@/shared/types/admin-settings'
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { settingsSchema } from '../validation/settings.schema'

const DEFAULTS: SystemSettings = {
  systemName: '在线考试系统',
  allowUserRegistration: true,
  maxLoginAttempts: 5,

  enableCaptcha: true,
  captchaAfterFailedAttempts: 3,

  enableStrongPassword: true,
  strongPasswordRules: {
    minLength: 8,
    requireUpper: true,
    requireLower: true,
    requireNumber: true,
    requireSymbol: false,
    forbidRepeated: true,
    forbidCommon: true,
  },

  aiEnabled: false,
  aiProvider: 'deepseek',
  aiBaseUrl: 'https://api.deepseek.com',
  aiApiKey: '',
  aiApiKeySet: false,
  aiModel: 'deepseek-v4-flash',
  aiAllowedModels: 'deepseek-v4-flash,deepseek-v4-pro',
  aiTemperature: 0.2,
  aiMaxTokens: 1200,
  aiTimeoutMs: 60000,
  aiThinkingMode: 'disabled',
}

export function useSettings() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState<SystemSettings | null>(null)
  const [current, setCurrent] = useState<SystemSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminSettingsApi.get()
      const merged = { ...DEFAULTS, ...(data ?? {}) } as SystemSettings
      setInitial(merged)
      setCurrent(merged)
    } catch (e) {
      console.error(e)
      message.error('加载系统设置失败')
      setInitial(DEFAULTS)
      setCurrent(DEFAULTS)
    } finally {
      setLoading(false)
    }
  }, [message])

  const save = useCallback(
    async (values: SystemSettings) => {
      try {
        const parsed = settingsSchema.parse(values)
        setLoading(true)
        await adminSettingsApi.update(parsed)

        const sanitized: SystemSettings = {
          ...parsed,
          aiApiKey: '',
          aiApiKeySet: Boolean(parsed.aiApiKeySet || (parsed.aiApiKey || '').trim()),
        }
        delete (sanitized as any).defaultPassword

        setInitial(prev => ({ ...(prev as SystemSettings), ...sanitized }))
        setCurrent(prev => ({ ...(prev as SystemSettings), ...sanitized }))
        message.success('系统设置保存成功')
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '保存系统设置失败')
        throw e
      } finally {
        setLoading(false)
      }
    },
    [message]
  )

  const isDirty = useMemo(() => {
    if (!initial || !current) return false
    if ((current.defaultPassword ?? '').trim().length > 0) return true
    const a = { ...initial }
    const b = { ...current }
    delete (a as any).defaultPassword
    delete (b as any).defaultPassword
    return JSON.stringify(a) !== JSON.stringify(b)
  }, [initial, current])

  useEffect(() => {
    load()
  }, [load])

  return { loading, initial, current, setCurrent, load, save, isDirty }
}
