// apps/web/src/features/analytics/hooks/useGrades.ts
import { api, isSuccess } from '@/shared/api/http'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GradeQuery, GradeStats, PaperLite, StudentResult } from '@/shared/types/grades'

type LoadResultsResp = {
  results: StudentResult[]
  pagination?: { totalPages?: number; total?: number }
}

export function useGrades(initialPageSize = 15) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<GradeStats | null>(null)
  const [papers, setPapers] = useState<PaperLite[]>([])
  const [results, setResults] = useState<StudentResult[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  const [query, setQuery] = useState<GradeQuery>({
    searchTerm: '',
    filterPaper: 'all',
    filterStatus: 'all',
    page: 1,
    limit: initialPageSize,
  })

  // 刷新键：点击“查询”或翻页时可强制刷新
  const [refreshKey, setRefreshKey] = useState(0)
  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  const debouncedSearch = useDebounce(query.searchTerm, 400)

  // 试卷列表
  const loadPapers = useCallback(async () => {
    try {
      const res = await api.get<{ papers: PaperLite[] } | PaperLite[]>('/papers')
      if (isSuccess(res)) {
        const data: any = res.data
        setPapers(Array.isArray(data) ? data : data?.papers ?? [])
      }
    } catch {}
  }, [])

  // 概览统计
  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<GradeStats>('/analytics/grade-stats')
      if (isSuccess(res)) setStats(res.data as GradeStats)
    } catch {}
  }, [])

  // 成绩列表
  const loadResults = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const paperId = query.filterPaper === 'all' || query.filterPaper === '' ? undefined : query.filterPaper
      const params = {
        page: query.page,
        limit: query.limit,
        paper_id: paperId,
        status: query.filterStatus === 'all' ? undefined : query.filterStatus,
        search: debouncedSearch || undefined,
        include_student_info: true,
      }
      const res = await api.get<LoadResultsResp | any>('/results', { params })
      if (isSuccess(res)) {
        const data: any = res.data || {}
        const list: StudentResult[] = data.results || data?.items || []
        setResults(list)
        setTotalPages(data.pagination?.totalPages || 1)
        setTotalResults(data.pagination?.total || list.length || 0)
      } else {
        setError((res as any).error || '加载成绩数据失败')
      }
    } catch (e: any) {
      setError(e?.message || '加载成绩数据失败')
    } finally {
      setLoading(false)
    }
  }, [query.page, query.limit, query.filterPaper, query.filterStatus, debouncedSearch])

  // 导出（后端返回 CSV）
  const exportResults = useCallback(async () => {
    const paperId = query.filterPaper === 'all' || query.filterPaper === '' ? undefined : query.filterPaper
    const params = {
      paper_id: paperId,
      status: query.filterStatus === 'all' ? undefined : query.filterStatus,
      search: (query.searchTerm || '').trim() || undefined,
    }
    const res = await api.get<Blob>('/results/export', { params, responseType: 'blob' } as any)
    if (isSuccess(res)) {
      const blob: any = (res as any).data
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `成绩报告_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      return true
    }
    throw new Error((res as any).error || '导出失败')
  }, [query.filterPaper, query.filterStatus, query.searchTerm])

  // 初始化
  useEffect(() => {
    loadPapers()
    loadStats()
  }, [loadPapers, loadStats])

  // 查询变更或强制刷新时加载
  useEffect(() => {
    loadResults()
  }, [loadResults, refreshKey])

  // setters
  const setSearchTerm = (v: string) => setQuery(prev => ({ ...prev, searchTerm: v }))
  const setFilterPaper = (v: string) => setQuery(prev => ({ ...prev, filterPaper: v }))
  const setFilterStatus = (v: string) => setQuery(prev => ({ ...prev, filterStatus: v }))
  const setPage = (p: number) => setQuery(prev => ({ ...prev, page: Math.max(1, p) }))
  const setLimit = (l: number) => setQuery(prev => ({ ...prev, limit: Math.max(1, l), page: 1 }))

  // 展示辅助（AntD 版本）
  const statusTagColor = useCallback((s: string): 'default' | 'processing' | 'success' | 'warning' | 'error' => {
    const v = String(s)
    if (v === 'completed' || v === 'submitted' || v === 'graded') return 'success'
    if (v === 'in_progress') return 'processing'
    if (v === 'not_started') return 'default'
    if (v === 'expired') return 'error'
    return 'default'
  }, [])
  const statusLabel = useCallback((s: string) => {
    const v = String(s)
    if (v === 'completed' || v === 'submitted' || v === 'graded') return '已完成'
    if (v === 'in_progress') return '进行中'
    if (v === 'not_started') return '未开始'
    if (v === 'expired') return '已过期'
    return '未知'
  }, [])
  const scoreTextType = useCallback((p?: number): 'success' | 'warning' | 'danger' | undefined => {
    if (p == null || Number.isNaN(p)) return undefined
    if (p >= 90) return 'success'
    if (p >= 60) return 'warning'
    return 'danger'
  }, [])

  return {
    // data
    loading,
    error,
    stats,
    papers,
    results,
    totalPages,
    totalResults,

    // query
    query,
    setSearchTerm,
    setFilterPaper,
    setFilterStatus,
    setPage,
    setLimit,

    // actions
    exportResults,

    // ui helpers
    statusTagColor,
    statusLabel,
    scoreTextType,

    // force refresh
    refetch,
  }
}
