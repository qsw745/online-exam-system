// src/features/exams/hooks/useExams.ts
import { useCallback, useEffect, useState } from 'react'
import { App } from 'antd'
import { exams, type exams, type ExamListParams } from '@/shared/api/endpoints/exams'

export function useExams(initial: ExamListParams = { page: 1, limit: 10, status: 'all' }) {
  const { message } = App.useApp()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<exams[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initial.page ?? 1)
  const [limit, setLimit] = useState(initial.limit ?? 10)
  const [search, setSearch] = useState(initial.search ?? '')
  const [status, setStatus] = useState<ExamListParams['status']>(initial.status ?? 'all')

  const load = useCallback(
    async (override?: Partial<ExamListParams>) => {
      try {
        setLoading(true)
        const res = await exams.list({
          page,
          limit,
          search,
          status,
          ...override,
        })
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
        setLimit(res.limit)
      } catch (e) {
        message.error('加载考试列表失败')
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
