// src/shared/hooks/usePapersList.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { papersApi, type Paper, type PaperDifficulty } from '@/shared/api/endpoints/papers'
import { useDebouncedValue } from './useDebouncedValue'
import { translate } from '@/shared/utils/i18n'

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
        search: debouncedSearch || undefined,
        difficulty,
      })
      setItems(items)
      setTotal(total)
    } catch (e: any) {
      console.error('加载试卷失败', e)
      message.error(e?.response?.data?.message || e?.message || translate('exam.load_error'))
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
      setItems(prev => prev.filter(p => String(p.id) !== id))
      try {
        // 两种都支持
        if ((papersApi as any).remove) await (papersApi as any).remove(id)
        else await (papersApi as any).delete(id)
        message.success(translate('auto.555e8d470f'))
        if (items.length === 1 && page > 1) {
          setPage(p => p - 1)
        } else {
          load()
        }
      } catch (e: any) {
        setItems(lastSnapshot.current) // 回滚
        message.error(e?.response?.data?.message || e?.message || translate('auto.0e861fa294'))
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

export default usePapersList
