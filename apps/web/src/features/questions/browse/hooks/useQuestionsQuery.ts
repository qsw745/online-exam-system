// hooks/useQuestionsQuery.ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import { questions, favorites as favoritesApi } from '@shared/api/http'
import { isSuccess, getErr, type ApiResult } from '../utils/apiResult'
import type { Filters, PaginationState, Question, ViewType } from '../types/question'
import { useLocation } from 'react-router-dom'

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
        const r: ApiResult<any> = await favoritesApi.list()
        if (!isSuccess(r)) throw new Error(getErr(r, '获取收藏失败'))
        const qs: Question[] = (r.data?.favorites ?? []).map((f: any) => f.question).filter(Boolean)
        setItems(qs)
        setPg(p => ({ ...p, totalQuestions: qs.length, totalPages: 1 }))
      } else if (viewType === 'wrong') {
        // TODO: 接错题接口时替换
        setItems([])
        setPg(p => ({ ...p, totalQuestions: 0, totalPages: 1 }))
        message.info('错题本功能正在开发中')
      } else {
        const r: ApiResult<any> = await questions.list({
          type: filters.filterType === 'all' ? undefined : filters.filterType,
          difficulty: filters.filterDifficulty === 'all' ? undefined : filters.filterDifficulty,
          search: filters.searchTerm || undefined,
          page: pg.currentPage,
          limit: pg.pageSize,
        })
        if (!isSuccess(r)) throw new Error(getErr(r, '获取题目列表失败'))
        const payload = r.data
        const list: Question[] = Array.isArray(payload) ? payload : payload?.questions ?? []
        setItems(list)
        const pp = payload?.pagination
        if (pp) setPg(p => ({ ...p, totalPages: pp.totalPages, totalQuestions: pp.total }))
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || '获取题目列表失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }, [user, viewType, filters, pg.currentPage, pg.pageSize])

  // 首次 & 依赖变更加载
  useEffect(() => {
    load()
  }, [load])

  // 对外暴露的改动器
  const setSearch = (v: string) => {
    setFilters(f => ({ ...f, searchTerm: v }))
    setPg(p => ({ ...p, currentPage: 1 }))
  }
  const setFilter = (k: 'type' | 'difficulty', v: string) => {
    setFilters(f => ({ ...f, [k === 'type' ? 'filterType' : 'filterDifficulty']: v }))
    setPg(p => ({ ...p, currentPage: 1 }))
  }
  const setPage = (p: number) => setPg(s => ({ ...s, currentPage: p }))
  const setPageSize = (size: number) => setPg(s => ({ ...s, pageSize: size, currentPage: 1 }))

  return { viewType, items, loading, filters, setSearch, setFilter, pg, setPage, setPageSize, reload: load }
}
