// features/tasks/hooks/useTaskById.ts
import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { tasksApi } from '@/shared/api/http'
import type { Task } from '@/shared/types/index'

export function useTaskById(id?: string) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(!!id)
  const [task, setTask] = useState<Task | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await tasksApi.getById(id)
      setTask(data)
    } catch (e: any) {
      message.error(e?.message || '加载任务失败')
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
