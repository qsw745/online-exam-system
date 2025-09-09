// src/shared/hooks/useQuestionsQuery.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import { api, isSuccess, getErr, type ApiResult } from '@/shared/api/http'
import { useLocation } from 'react-router-dom'

// —— 本地最小类型，避免依赖 @shared/types/question 名字不一致 —— //
type QuestionType = 'single' | 'multiple' | 'true_false' | 'short_answer' | string
type Difficulty = 'easy' | 'medium' | 'hard' | string

export interface Question {
  id: string
  type?: QuestionType
  difficulty?: Difficulty
  score?: number
  [k: string]: any
}
export type ViewType = 'favorites' | 'wrong' | 'browse' | 'manage' | 'all'

export interface Filters {
  searchTerm: string
  filterType: 'all' | QuestionType
  filterDifficulty: 'all' | Difficulty
}
export interface PaginationState {
  currentPage: number
  totalPages: number
  totalQuestions: number
  pageSize: number
}

const initFilters: Filters = { searchTerm: '', filterType: 'all', filterDifficulty: 'all' }
const initPg: PaginationState = { currentPage: 1, totalPages: 1, totalQuestions: 0, pageSize: 12 }

export function useQuestionsQuery(user?: { id: string } | null) {
  const location = useLocation()
  const viewType: ViewType = useMemo(() => {
    const p = location.pathname
    if (p.includes('/favorites')) return 'favorites'
    if (p.includes('/wrong')) return 'wrong'
    if (p.includes('/browse')) return 'browse'
    if (p.includes('/manage')) return 'manage'
    return 'all'
  }, [location.pathname])

  const [items, setItems] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(initFilters)
  const [pg, setPg] = useState<PaginationState>(initPg)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    try {
      if (viewType === 'favorites') {
        // 直接调用 /favorites，避免依赖 favoritesApi
        const r = await api.get<any>('/favorites')
        if (!isSuccess(r)) throw new Error(getErr(r, '获取收藏失败'))
        const favList = (r.data?.favorites ?? r.data ?? []) as any[]
        const qs: Question[] = favList.map(f => f?.question ?? f).filter(Boolean)
        setItems(qs)
        setPg((p: PaginationState) => ({ ...p, totalQuestions: qs.length, totalPages: 1 }))
      } else if (viewType === 'wrong') {
        setItems([])
        setPg((p: PaginationState) => ({ ...p, totalQuestions: 0, totalPages: 1 }))
        message.info('错题本功能正在开发中')
      } else {
        // 统一使用 keyword/type/difficulty/page/limit，后端若只识别部分字段也能兼容
        const params = {
          keyword: filters.searchTerm || undefined,
          type: filters.filterType === 'all' ? undefined : filters.filterType,
          difficulty: filters.filterDifficulty === 'all' ? undefined : filters.filterDifficulty,
          page: pg.currentPage,
          limit: pg.pageSize,
        }
        const r: ApiResult<any> = await api.get('/questions', { params })
        if (!isSuccess(r)) throw new Error(getErr(r, '获取题目列表失败'))
        const payload = r.data
        // 兼容多种 data 结构
        const list: Question[] = Array.isArray(payload)
          ? payload
          : payload?.items ?? payload?.list ?? payload?.questions ?? []
        setItems(list)
        const total =
          payload?.total ??
          payload?.count ??
          payload?.pagination?.total ??
          payload?.pagination?.totalItems ??
          list.length
        const pages =
          payload?.pages ??
          payload?.pageCount ??
          payload?.pagination?.totalPages ??
          Math.max(1, Math.ceil(total / pg.pageSize))
        setPg((p: PaginationState) => ({ ...p, totalPages: pages, totalQuestions: total }))
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || '获取题目列表失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }, [user, viewType, filters, pg.currentPage, pg.pageSize])

  useEffect(() => {
    load()
  }, [load])

  const setSearch = (v: string) => {
    setFilters((f: Filters) => ({ ...f, searchTerm: v }))
    setPg((p: PaginationState) => ({ ...p, currentPage: 1 }))
  }
  const setFilter = (k: 'type' | 'difficulty', v: string) => {
    setFilters((f: Filters) => ({ ...f, [k === 'type' ? 'filterType' : 'filterDifficulty']: v }))
    setPg((p: PaginationState) => ({ ...p, currentPage: 1 }))
  }
  const setPage = (p: number) => setPg((s: PaginationState) => ({ ...s, currentPage: p }))
  const setPageSize = (size: number) => setPg((s: PaginationState) => ({ ...s, pageSize: size, currentPage: 1 }))

  return { viewType, items, loading, filters, setSearch, setFilter, pg, setPage, setPageSize, reload: load }
}

export default useQuestionsQuery
