// src/features/tasks/hooks/useTasksQuery.ts
import { App } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { tasksApi } from '@/shared/api/http'
import { isSuccess } from '@/shared/api/http'

export type Task = {
  id: string
  title: string
  description?: string
  assigned_users?: Array<{ id: number; name: string }>
  status: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived' | string
  start_time?: string | null
  end_time?: string | null
  created_at?: string | null
}

export interface TaskFilters {
  keyword?: string
  status?: string // 'all' | TaskStatus
  range?: [dayjs.Dayjs, dayjs.Dayjs] | null
}

export function useTasksQuery(initialPageSize = 10) {
  const { message } = App.useApp()
  const [filters, setFilters] = useState<TaskFilters>({ status: 'all' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Task[]>([])

  const params = useMemo(() => {
    const p: any = {
      page,
      limit: pageSize,
      search: filters.keyword || undefined,
      status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    }
    if (filters.range?.length === 2) {
      p.start_from = filters.range[0].startOf('day').toISOString()
      p.end_to = filters.range[1].endOf('day').toISOString()
    }
    return p
  }, [filters, page, pageSize])

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await(tasksApi as any).list?.(params)
      if (!isSuccess(res)) {
        message.error(res?.error || res?.message || '加载任务失败')
        setRows([])
        setTotal(0)
        return
      }
      const d = res.data
      if (Array.isArray(d)) {
        setRows(d as Task[])
        setTotal(d.length)
      } else if (d && typeof d === 'object') {
        const arr = (d.items ?? d.tasks ?? []) as Task[]
        setRows(Array.isArray(arr) ? arr : [])
        const pg = d.pagination ?? {}
        setTotal(pg.total ?? d.total ?? arr.length ?? 0)
      } else {
        setRows([])
        setTotal(0)
      }
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载任务失败')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [params, message])

  useEffect(() => {
    fetch()
  }, [fetch])

  const search = (next: TaskFilters) => {
    setFilters(next)
    setPage(1)
  }
  const reset = () => {
    setFilters({ status: 'all' })
    setPage(1)
  }

  return { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search, reset, refetch: fetch }
}

export default useTasksQuery
