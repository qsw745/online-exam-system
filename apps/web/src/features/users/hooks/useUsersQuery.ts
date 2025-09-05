// features/users/hooks/useUsersQuery.ts
import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { usersService } from '../services/users.service'

export function useUsersQuery(initialPageSize = 10) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [total, setTotal] = useState(0)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { rows, total } = await usersService.list({ page, limit: pageSize })
      setRows(rows)
      setTotal(total)
    } catch (e: any) {
      console.error(e)
      message.error(e?.message || '加载用户失败')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, message])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { rows, total, loading, page, pageSize, setPage, setPageSize, refetch: fetch }
}
