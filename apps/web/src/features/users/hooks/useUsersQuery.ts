// src/features/users/hooks/useUsersQuery.ts
import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { isSuccess } from '@/shared/api/http'
import { usersApi } from '@/shared/api/endpoints/users'

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
      const res: any = await (usersApi as any).list?.({ page, limit: pageSize })
      if (!isSuccess(res)) {
        message.error(res?.error || res?.message || '加载用户失败')
        setRows([])
        setTotal(0)
        return
      }
      const d = res.data
      if (Array.isArray(d)) {
        setRows(d)
        setTotal(d.length)
      } else if (d && typeof d === 'object') {
        const arr = d.items ?? d.users ?? []
        setRows(Array.isArray(arr) ? arr : [])
        const pg = d.pagination ?? {}
        setTotal(pg.total ?? d.total ?? arr.length ?? 0)
      } else {
        setRows([])
        setTotal(0)
      }
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

export default useUsersQuery
