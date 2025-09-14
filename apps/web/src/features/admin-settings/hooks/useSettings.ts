import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SystemSettings } from '@/shared/types/admin-settings'
import { adminSettingsApi } from '@/shared/api/endpoints/admin-settings'
import { settingsSchema } from '../validation/settings.schema'

export function useSettings() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [initial, setInitial] = useState<SystemSettings | null>(null)
  const [current, setCurrent] = useState<SystemSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminSettingsApi.get()
      setInitial(data)
      setCurrent(data)
    } catch (e) {
      console.error(e)
      message.error('加载系统设置失败')
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
        const parsed = settingsSchema.parse(values)
        setLoading(true)
        await adminSettingsApi.update(parsed)

        // 保存成功后，写回状态并清除写入型字段
        const sanitized: SystemSettings = { ...parsed }
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

  // ✅ “是否脏”逻辑：除去 defaultPassword 的普通字段对比；若仅填写了 defaultPassword 也算脏
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
