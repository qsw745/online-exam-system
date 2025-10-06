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
  current: number
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

  /** 兼容旧页面命名： */
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

  const [pg, setPg] = React.useState<Pagination>({ page: 1, pageSize: 10, total: 0 ,current:1})
  const [loading, setLoading] = React.useState(false)
  const [items, setItems] = React.useState<any[]>([])
  const [allTags, setAllTags] = React.useState<string[]>([])

  // 查重模式
  const [dup, setDup] = React.useState<DupMode>({ dupOnly: false, isGrouped: false })

  const fetchTags = React.useCallback(async () => {
    try {
      const r: any = await questionsApi.getTags()
      const data = r?.data ?? r
      setAllTags(Array.isArray(data) ? data : [])
    } catch {}
  }, [])

  const fetchList = React.useCallback(async () => {
    if (!user) {
      // 没有登录用户时也允许取公共列表（若后端鉴权限制，这里直接返回空）
      // 你也可以选择直接 return
    }
    setLoading(true)
    try {
      const params: any = { page: pg.page, limit: pg.pageSize }

      // 基础筛选
      if (filters.search?.trim()) {
        params.keyword = filters.search.trim()
        params.search = filters.search.trim()
      }
      if (filters.type && filters.type !== 'all') params.type = filters.type
      if (filters.difficulty && filters.difficulty !== 'all') params.difficulty = filters.difficulty
      if (filters.tags?.length) params.tags = filters.tags.join(',')

      // 查重开关
      if (dup.dupOnly) {
        params.duplicates = dup.isGrouped ? 'grouped' : 'title_type' // 与后端控制器保持一致
      }

      const r: any = await questionsApi.list(params)
      const d = r?.data

      // 普通列表
      if (!dup.dupOnly) {
        const list = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
        const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)
        setItems(list)
        setPg(s => ({ ...s, total: Number(total) || 0 }))
      } else {
        // 查重列表（平铺 or 分组）
        if (dup.isGrouped && d?.grouped) {
          // 分组结构：{ grouped:true, groups:[{title,question_type,dup_count,items:[] }], pagination:{ totalGroups... } }
          const groups = Array.isArray(d.groups) ? d.groups : []
          // 你原页面大概率还是平铺渲染，给它一个拍平的 list，同时保留组的 display_title
          const flattened: any[] = []
          for (const g of groups) {
            for (const it of g.items || []) {
              flattened.push(it)
            }
          }
          setItems(flattened)
          const totalGroups = d?.pagination?.totalGroups ?? groups.length
          setPg(s => ({ ...s, total: Number(totalGroups) || flattened.length }))
        } else {
          // 平铺重复列表：后端已返回 display_title / dup_total / dup_index
          const list = Array.isArray(d) ? d : d?.items ?? d?.questions ?? []
          const total = d?.total ?? d?.pagination?.total ?? (Array.isArray(d) ? d.length : 0)
          setItems(list)
          setPg(s => ({ ...s, total: Number(total) || 0 }))
        }
      }
    } finally {
      setLoading(false)
    }
  }, [
    user,
    pg.page,
    pg.pageSize,
    filters.search,
    filters.type,
    filters.difficulty,
    filters.tags,
    dup.dupOnly,
    dup.isGrouped,
  ])

  React.useEffect(() => {
    fetchList()
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
    },
    isGrouped: dup.isGrouped,
    setIsGrouped: (v: boolean) => {
      setDup(s => ({ ...s, isGrouped: v }))
      setPg(s => ({ ...s, page: 1 }))
    },
  }
}

export default useQuestionsQuery
