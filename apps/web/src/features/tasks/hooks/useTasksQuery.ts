// src/features/tasks/hooks/useTasksQuery.ts
import { App } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import { translate } from '@/shared/utils/i18n'

export type Task = {
  id: string
  title: string
  description?: string
  assigned_users?: Array<{ id: number; name?: string; username?: string }>
  status:
    | 'draft'
    | 'published'
    | 'unpublished'
    | 'not_started'
    | 'in_progress'
    | 'completed'
    | 'expired'
    | 'archived'
    | string
  type?: 'exam' | 'practice'
  exam_id?: number | null
  my_result_id?: number | string | null
  my_result_status?: string | null
  my_result_score?: number | null
  start_time?: string | null
  end_time?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface TaskFilters {
  keyword?: string
  status?: string // 'all' | 具体状态
  range?: [dayjs.Dayjs, dayjs.Dayjs] | null
  type?: 'exam' | 'practice' | 'all'
}

type Options = { scope?: 'all' | 'mine' }

export function useTasksQuery(initialPageSize = 10, options: Options = { scope: 'all' }) {
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
      type: filters.type && filters.type !== 'all' ? filters.type : undefined,
    }
    if (filters.range?.length === 2) {
      p.start_from = filters.range[0].startOf('day').toISOString()
      p.end_to = filters.range[1].endOf('day').toISOString()
    }
    if (options.scope === 'mine') p.mine = 1 // 给旧接口兜底
    return p
  }, [filters, page, pageSize, options.scope])

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      // 优先 mine 接口，回退到 list + ?mine=1
      const apiCaller =
        options.scope === 'mine'
          ? (tasksApi as any).mine || (tasksApi as any).listMine || (tasksApi as any).list
          : (tasksApi as any).list

      const res: any = await apiCaller?.(params)
      if (!isSuccess(res)) {
        message.error(res?.error || res?.message || translate('tasks.load_error'))
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
        setTotal(pg.total ?? d.total ?? arr?.length ?? 0)
      } else {
        setRows([])
        setTotal(0)
      }
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || translate('tasks.load_error'))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [params, message, options.scope])

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

  return {
    rows,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    filters,
    search,
    reset,
    refetch: fetch,
    setRows,
  }
}

export default useTasksQuery
