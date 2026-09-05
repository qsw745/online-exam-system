import { useCallback, useEffect, useRef, useState } from 'react'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import type { Task } from '@/shared/types'
import { translate } from '@/shared/utils/i18n'

export function useTaskById(id?: string) {
  const [loading, setLoading] = useState(!!id)
  const [task, setTask] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)

  const fetch = useCallback(async () => {
    const version = ++requestVersion.current
    if (!id || !/^\d+$/.test(id) || Number(id) <= 0) {
      setTask(null)
      setError('任务链接无效，请返回任务列表重新选择')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setTask(null)
    try {
      // 兼容两种返回：ApiResult<T> 或者直接 T
      const res: any = await tasksApi.getById(id)
      if (version !== requestVersion.current) return
      if (res?.success === false) throw new Error(res?.error || res?.message || translate('tasks.load_error'))
      const data = res?.data ?? res
      const entity = data?.task ?? data
      setTask(entity?.id != null ? entity : null)
    } catch (e: any) {
      if (version !== requestVersion.current) return
      setError(e?.message || translate('tasks.load_error'))
      setTask(null)
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetch()
    return () => { requestVersion.current += 1 }
  }, [fetch])

  return { loading, task, error, refetch: fetch }
}
