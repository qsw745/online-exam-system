// features/admin-settings/hooks/useSettings.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SystemSettings } from '../../../shared/types/admin-settings'
import { settingsService } from '../services/settings'
import { settingsSchema } from '../validation/settings.schema'

export function useSettings() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState<SystemSettings | null>(null)
  const [current, setCurrent] = useState<SystemSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await settingsService.get()
      setInitial(data)
      setCurrent(data)
    } catch (e) {
      console.error(e)
      message.error('加载系统设置失败')
      // 提供兜底默认
      const fallback: SystemSettings = {
        systemName: '在线考试系统',
        allowUserRegistration: true,
        maxLoginAttempts: 5,
      }
      setInitial(fallback)
      setCurrent(fallback)
    } finally {
      setLoading(false)
    }
  }, [message])

  const save = useCallback(
    async (values: SystemSettings) => {
      try {
        // 校验
        const parsed = settingsSchema.parse(values)
        setLoading(true)
        await settingsService.update(parsed)
        setInitial(prev => ({ ...(prev as SystemSettings), ...parsed, defaultPassword: undefined }))
        setCurrent(prev => ({ ...(prev as SystemSettings), ...parsed, defaultPassword: undefined }))
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
