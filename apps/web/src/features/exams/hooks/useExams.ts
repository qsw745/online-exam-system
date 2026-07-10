import { useCallback, useEffect, useState } from 'react'
import { App } from 'antd'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { translate } from '@/shared/utils/i18n'

export type ExamListParams = {
  page?: number
  limit?: number
  search?: string
  status?: 'all' | 'published' | 'in_progress' | 'completed' | 'not_started' | 'expired'
}

type ExamListItem = any

function normalizeExamItem(item: any): ExamListItem {
  const resultStatus = item?.my_result_status ?? item?.my_status ?? null
  const resultScore = item?.my_result_score ?? item?.my_score ?? null
  return {
    ...item,
    duration: item?.duration ?? item?.exam_duration ?? null,
    total_score: item?.total_score ?? item?.exam_total_score ?? null,
    my_status: item?.my_status ?? resultStatus,
    my_score: item?.my_score ?? resultScore,
    my_result_status: item?.my_result_status ?? resultStatus,
    my_result_score: item?.my_result_score ?? resultScore,
  }
}

export function useExams(initial: ExamListParams = { page: 1, limit: 10, status: 'all' }) {
  const { message } = App.useApp()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ExamListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initial.page ?? 1)
  const [limit, setLimit] = useState(initial.limit ?? 10)
  const [search, setSearch] = useState(initial.search ?? '')
  const [status, setStatus] = useState<NonNullable<ExamListParams['status']>>(initial.status ?? 'all')

  const load = useCallback(
    async (override?: Partial<ExamListParams>) => {
      try {
        setLoading(true)
        const params = {
          page,
          limit,
          search,
          status,
          type: 'exam', // ✅ 仅拉取考试型任务
          ...override,
        }
        const res: any = await tasksApi.listMine(params as any)
        const payload = res?.data ?? res
        const list = payload?.items ?? payload?.list ?? payload?.tasks ?? (Array.isArray(payload) ? payload : [])
        setItems(Array.isArray(list) ? list.map(normalizeExamItem) : [])
        setTotal(Number(payload?.total ?? 0))
        setPage(Number(payload?.page ?? params.page ?? 1))
        setLimit(Number(payload?.limit ?? params.limit ?? 10))
      } catch (e) {
        console.error(e)
        message.error(translate('auto.bf50e95ceb'))
        setItems([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [limit, message, page, search, status]
  )

  useEffect(() => {
    load()
  }, [load])

  const onSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    load({ page: 1, search: value })
  }

  const onStatusChange = (s: NonNullable<ExamListParams['status']>) => {
    setStatus(s)
    setPage(1)
    load({ page: 1, status: s })
  }

  const onPageChange = (p: number, ps?: number) => {
    setPage(p)
    if (ps && ps !== limit) setLimit(ps)
    load({ page: p, limit: ps ?? limit })
  }

  return {
    loading,
    items,
    total,
    page,
    limit,
    search,
    status,
    // handlers
    onSearch,
    onStatusChange,
    onPageChange,
  }
}
