// src/shared/hooks/useQuestionsQuery.ts
import * as React from 'react'
import { questionsApi } from '@/shared/api/http'

/** 轻量防抖：返回函数带 .flush()/.cancel()，不依赖第三方 */
function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const fnRef = React.useRef(fn)
  React.useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = React.useRef<any[] | null>(null)

  const cancel = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (lastArgsRef.current) {
      // @ts-expect-error 参数透传
      fnRef.current(...lastArgsRef.current)
      lastArgsRef.current = null
    }
  }, [])

  const debounced = React.useCallback(
    (...args: any[]) => {
      lastArgsRef.current = args
      cancel()
      timerRef.current = setTimeout(flush, delay)
    },
    [delay, cancel, flush]
  ) as T & { flush: () => void; cancel: () => void }

  ;(debounced as any).flush = flush
  ;(debounced as any).cancel = cancel
  return debounced
}

type ViewType = 'all' | 'favorites' | 'wrong' | 'browse' | 'manage'

type Filters = {
  type: string
  difficulty: string
  search: string
}

type Pagination = {
  currentPage: number
  pageSize: number
  totalQuestions: number
}

export function useQuestionsQuery(user: { id?: number } | null) {
  const [viewType] = React.useState<ViewType>('all')

  const [filters, setFilters] = React.useState<Filters>({ type: '', difficulty: '', search: '' })

  const [pg, setPg] = React.useState<Pagination>({ currentPage: 1, pageSize: 12, totalQuestions: 0 })

  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<any[]>([])

  const fetchList = React.useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const params: any = { page: pg.currentPage, limit: pg.pageSize }
      if (filters.search?.trim()) {
        params.keyword = filters.search.trim()
        params.search = filters.search.trim()
      }
      if (filters.type && filters.type !== 'all') params.type = filters.type
      if (filters.difficulty && filters.difficulty !== 'all') params.difficulty = filters.difficulty

      const r: any = await questionsApi.list(params)
      const d = r?.data
      const list = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
      const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)

      setItems(list)
      setPg(s => ({ ...s, totalQuestions: Number(total) || 0 }))
    } finally {
      setLoading(false)
    }
  }, [user, pg.currentPage, pg.pageSize, filters.search, filters.type, filters.difficulty])

  React.useEffect(() => {
    fetchList()
  }, [fetchList])

  // —— setters —— //
  const setPage = (page: number) => setPg(s => ({ ...s, currentPage: page }))
  const setPageSize = (size: number) => setPg(s => ({ ...s, pageSize: size, currentPage: 1 }))

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters(s => ({ ...s, [key]: value }))
    setPg(s => ({ ...s, currentPage: 1 }))
  }

  const debouncedSetSearch = useDebouncedCallback((v: string) => {
    setFilters(s => ({ ...s, search: v }))
    setPg(s => ({ ...s, currentPage: 1 }))
  }, 300)

  const setSearch = (v: string, opts?: { immediate?: boolean }) => {
    if (opts?.immediate) {
      debouncedSetSearch.cancel()
      setFilters(s => ({ ...s, search: v }))
      setPg(s => ({ ...s, currentPage: 1 }))
    } else {
      debouncedSetSearch(v)
    }
  }

  const reload = () => fetchList()

  return { viewType, filters, setFilter, setSearch, pg, setPage, setPageSize, loading, items, reload }
}

/** 兼容旧代码：提供默认导出 */
export default useQuestionsQuery
