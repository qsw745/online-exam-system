// src/shared/hooks/useResults.ts
import { useCallback, useEffect, useState } from 'react'
import { App } from 'antd'
import { resultsApi, type ResultItem, type ResultStatus } from '@/shared/api/endpoints/results'

export function useResults(initialPageSize = 12) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ResultItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState<ResultStatus | 'all'>('all')

  const [page, setPage] = useState(1)
  const [limit] = useState(initialPageSize)
  const [total, setTotal] = useState(0)

  const fetchList = useCallback(async () => {
    try {
      setLoading(true)
      const res = await resultsApi.list({
        page,
        limit,
        status: status === 'all' ? undefined : status,
        search: searchTerm || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e: any) {
      console.error('加载考试结果失败:', e)
      message.error(e?.message || '加载考试结果失败')
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, searchTerm, message])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 交互便捷方法
  const onSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }
  const onStatusChange = (val: ResultStatus | 'all') => {
    setStatus(val)
    setPage(1)
  }

  return {
    // state
    loading,
    items,
    page,
    limit,
    total,
    searchTerm,
    status,
    // actions
    setPage,
    onSearch,
    onStatusChange,
    refetch: fetchList,
  }
}
export default useResults
