// features/papers/hooks/usePapersList.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { papersApi, type Paper, type PaperDifficulty } from '../endpoints/papers'
import { useDebouncedValue } from './useDebouncedValue'

export function usePapersList() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Paper[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebouncedValue(searchTerm, 400)
  const [difficulty, setDifficulty] = useState<PaperDifficulty | 'all'>('all')

  const lastSnapshot = useRef<Paper[]>([])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { items, total } = await papersApi.list({
        page,
        limit: pageSize,
        search: debouncedSearch,
        difficulty,
      })
      setItems(items)
      setTotal(total)
    } catch (e: any) {
      console.error('加载试卷失败', e)
      message.error(e?.response?.data?.message || '加载试卷失败')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, difficulty, message])

  useEffect(() => {
    load()
  }, [load])

  const onDelete = useCallback(
    async (id: string) => {
      // 乐观更新
      lastSnapshot.current = items
      setItems(prev => prev.filter(p => p.id !== id))
      try {
        await papersApi.remove(id)
        message.success('试卷删除成功')
        // 若本页删空了，尝试回到上一页再拉取
        if (items.length === 1 && page > 1) {
          setPage(p => p - 1)
        } else {
          load()
        }
      } catch (e: any) {
        // 回滚
        setItems(lastSnapshot.current)
        message.error(e?.response?.data?.message || '删除试卷失败')
      }
    },
    [items, load, message, page]
  )

  const pagination = useMemo(
    () => ({
      current: page,
      pageSize,
      total,
      setCurrent: setPage,
      setPageSize: (s: number) => {
        setPageSize(s)
        setPage(1)
      },
    }),
    [page, pageSize, total]
  )

  return {
    // data
    items,
    total,
    loading,
    // filters
    searchTerm,
    setSearchTerm,
    difficulty,
    setDifficulty,
    // pagination
    pagination,
    // actions
    onDelete,
    reload: load,
  }
}
