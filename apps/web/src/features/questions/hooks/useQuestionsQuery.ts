// src/features/questions/hooks/useQuestionsQuery.ts
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
      fnRef.current(...(lastArgsRef.current as any))
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

export type ViewType = 'all' | 'favorites' | 'wrong' | 'browse' | 'manage'

export type Filters = {
  type: string
  difficulty: string
  search: string
  tags: string[]
}

type Pagination = {
  page: number
  pageSize: number
  total: number
}

type DupMode = {
  dupOnly: boolean // 是否只看重复
  isGrouped: boolean // 重复是否按组返回
}

type QueryResult = {
  viewType: ViewType
  filters: Filters
  setFilter: (key: keyof Filters, value: string) => void
  setSearch: (v: string, opts?: { immediate?: boolean }) => void
  setTags: (tags: string[]) => void

  // 兼容旧页面命名：
  search: string
  type: string
  selectedTags: string[]
  setSelectedTags: (tags: string[]) => void

  pg: Pagination
  page: number
  pageSize: number
  total: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void

  loading: boolean
  items: any[]
  list: any[]

  reload: () => Promise<void>
  allTags: string[]
  reloadTags: () => Promise<void>

  // 查重开关
  dupOnly: boolean
  setDupOnly: (v: boolean) => void
  isGrouped: boolean
  setIsGrouped: (v: boolean) => void
}

/** user 现在是可选的，避免“应有 1 个参数，但获得 0 个”的报错 */
export function useQuestionsQuery(user?: { id?: number } | null): QueryResult {
  const [viewType] = React.useState<ViewType>('all')

  const [filters, setFilters] = React.useState<Filters>({
    type: '',
    difficulty: '',
    search: '',
    tags: [],
  })

  const [pg, setPg] = React.useState<Pagination>({ page: 1, pageSize: 10, total: 0 })
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<any[]>([])
  const [allTags, setAllTags] = React.useState<string[]>([])

  // 查重模式
  const [dup, setDup] = React.useState<DupMode>({ dupOnly: false, isGrouped: false })

  // —— 稳定的 userId 依赖（避免 user 对象引用变化导致重复请求）—— //
  const userId = Number.isFinite(Number(user?.id)) ? Number(user?.id) : undefined

  // —— 请求去重：相同参数不重复发起 —— //
  const lastSigRef = React.useRef<string>('') // 上一次参数签名
  const abortRef = React.useRef<AbortController | null>(null) // 取消上一次请求

  const fetchTags = React.useCallback(async () => {
    try {
      const r: any = await questionsApi.getTags()
      const data = r?.data ?? r
      setAllTags(Array.isArray(data) ? data : [])
    } catch {
      // 忽略标签错误
    }
  }, [])

  const buildParams = React.useCallback(() => {
    const p: any = { page: pg.page, limit: pg.pageSize }

    if (filters.search?.trim()) {
      p.keyword = filters.search.trim()
      p.search = filters.search.trim()
    }
    if (filters.type && filters.type !== 'all') p.type = filters.type
    if (filters.difficulty && filters.difficulty !== 'all') p.difficulty = filters.difficulty
    if (filters.tags?.length) p.tags = filters.tags.join(',')

    if (dup.dupOnly) {
      p.duplicates = dup.isGrouped ? 'grouped' : 'title_type'
    }

    // 可选：带上 userId（若后端需要）
    if (userId) p.userId = userId

    return p
  }, [
    pg.page,
    pg.pageSize,
    filters.search,
    filters.type,
    filters.difficulty,
    filters.tags,
    dup.dupOnly,
    dup.isGrouped,
    userId,
  ])

  const fetchList = React.useCallback(async () => {
    const params = buildParams()
    const signature = JSON.stringify(params)

    // 1) 相同参数不再请求
    if (signature === lastSigRef.current) return
    lastSigRef.current = signature

    // 2) 取消上一轮
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    try {
      const r: any = await questionsApi.list(params, { signal: ac.signal } as any)
      const d = r?.data

      if (!dup.dupOnly) {
        const list = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
        const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)
        setItems(list)
        setPg(s => {
          const next = { ...s, total: Number(total) || 0 }
          return next
        })
      } else {
        if (dup.isGrouped && d?.grouped) {
          const groups = Array.isArray(d.groups) ? d.groups : []
          const flattened: any[] = []
          for (const g of groups) for (const it of g.items || []) flattened.push(it)
          setItems(flattened)
          const totalGroups = d?.pagination?.totalGroups ?? groups.length
          setPg(s => ({ ...s, total: Number(totalGroups) || flattened.length }))
        } else {
          const list = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
          const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)
          setItems(list)
          setPg(s => ({ ...s, total: Number(total) || 0 }))
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        // 这里可以上报日志
        // console.error(err)
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null
      setLoading(false)
    }
  }, [buildParams, dup.dupOnly, dup.isGrouped])

  // 仅依赖稳定的参数集合与 userId
  React.useEffect(() => {
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchList])

  React.useEffect(() => {
    fetchTags()
  }, [fetchTags])

  // —— setters —— //
  const setPage = (page: number) => setPg(s => ({ ...s, page }))
  const setPageSize = (size: number) => setPg(s => ({ ...s, pageSize: size, page: 1 }))

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters(s => ({ ...s, [key]: value }))
    setPg(s => ({ ...s, page: 1 }))
  }
  const setTags = (tags: string[]) => {
    setFilters(s => ({ ...s, tags }))
    setPg(s => ({ ...s, page: 1 }))
  }

  const debouncedSetSearch = useDebouncedCallback((v: string) => {
    setFilters(s => ({ ...s, search: v }))
    setPg(s => ({ ...s, page: 1 }))
  }, 300)

  const setSearch = (v: string, opts?: { immediate?: boolean }) => {
    if (opts?.immediate) {
      debouncedSetSearch.cancel()
      setFilters(s => ({ ...s, search: v }))
      setPg(s => ({ ...s, page: 1 }))
    } else {
      debouncedSetSearch(v)
    }
  }

  const reload = async () => {
    // 重置签名保证一定会重新发请求
    lastSigRef.current = ''
    await fetchList()
  }
  const reloadTags = async () => {
    await fetchTags()
  }

  // 兼容旧命名
  const setSelectedTags = (tags: string[]) => setTags(tags)

  return {
    viewType,
    filters,
    setFilter,
    setSearch,
    setTags,

    // 兼容旧页面字段
    search: filters.search,
    type: filters.type,
    selectedTags: filters.tags,
    setSelectedTags,

    pg,
    page: pg.page,
    pageSize: pg.pageSize,
    total: pg.total,
    setPage,
    setPageSize,

    loading,
    items,
    list: items,

    reload,
    allTags,
    reloadTags,

    dupOnly: dup.dupOnly,
    setDupOnly: (v: boolean) => {
      setDup(s => ({ ...s, dupOnly: v }))
      setPg(s => ({ ...s, page: 1 }))
      // 触发新请求：清空签名
      lastSigRef.current = ''
    },
    isGrouped: dup.isGrouped,
    setIsGrouped: (v: boolean) => {
      setDup(s => ({ ...s, isGrouped: v }))
      setPg(s => ({ ...s, page: 1 }))
      lastSigRef.current = ''
    },
  }
}

export default useQuestionsQuery
