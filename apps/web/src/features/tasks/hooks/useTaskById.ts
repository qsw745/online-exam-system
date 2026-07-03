import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import type { Task } from '@/shared/types'
import { translate } from '@/shared/utils/i18n'

export function useTaskById(id?: string) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(!!id)
  const [task, setTask] = useState<Task | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      // 兼容两种返回：ApiResult<T> 或者直接 T
      const res: any = await tasksApi.getById(id)
      const data = res?.data ?? res
      const entity = data?.task ?? data
      setTask(entity ?? null)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || translate('tasks.load_error'))
      setTask(null)
    } finally {
      setLoading(false)
    }
  }, [id, message])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { loading, task, refetch: fetch }
}
