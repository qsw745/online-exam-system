import { useCallback, useEffect, useState } from 'react'
import { App } from 'antd'
import { resultsApi, type ResultItem, type ResultStatus } from '@/shared/api/endpoints/results'
import { translate } from '@/shared/utils/i18n'

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
        sort: 'created_at',
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (e: any) {
      console.error('加载考试结果失败:', e)
      message.error(e?.message || translate('auto.de79ab07e4'))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, searchTerm, message])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  return {
    loading,
    items,
    page,
    limit,
    total,
    searchTerm,
    status,
    setPage,
    onSearch: (v: string) => {
      setSearchTerm(v)
      setPage(1)
    },
    onStatusChange: (v: ResultStatus | 'all') => {
      setStatus(v)
      setPage(1)
    },
    refetch: fetchList,
  }
}

export default useResults
