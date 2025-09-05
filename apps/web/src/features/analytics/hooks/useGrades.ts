import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, isSuccess } from '@shared/api/http'
import { useDebounce } from '@shared/hooks/useDebounce'
import type { GradeQuery, GradeStats, PaperLite, StudentResult } from '../types/grades'

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

  const debouncedSearch = useDebounce(query.searchTerm, 400)

  // 试卷列表
  const loadPapers = useCallback(async () => {
    try {
      const res = await api.get<{ papers: PaperLite[] } | PaperLite[]>('/papers')
      if (isSuccess(res)) {
        const data: any = res.data
        setPapers(Array.isArray(data) ? data : data?.papers ?? [])
      }
    } catch (e) {
      // 忽略：不影响主流程
    }
  }, [])

  // 概览统计
  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<GradeStats>('/analytics/grade-stats')
      if (isSuccess(res)) setStats(res.data as GradeStats)
    } catch (e) {
      // 忽略：不影响主流程
    }
  }, [])

  // 成绩列表
  const loadResults = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page: query.page,
        limit: query.limit,
        paper_id: query.filterPaper === 'all' ? undefined : query.filterPaper,
        status: query.filterStatus === 'all' ? undefined : query.filterStatus,
        search: debouncedSearch || undefined,
        include_student_info: true,
      }
      const res = await api.get<LoadResultsResp | any>('/exam_results', { params })
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

  // 导出
  const exportResults = useCallback(async () => {
    const params = {
      paper_id: query.filterPaper === 'all' ? undefined : query.filterPaper,
      status: query.filterStatus === 'all' ? undefined : query.filterStatus,
      search: (debouncedSearch || '').trim() || undefined,
    }
    const res = await api.get<Blob>('/exam_results/export', { params, responseType: 'blob' } as any)
    if (isSuccess(res)) {
      const blob: any = (res as any).data
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `成绩报告_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      return true
    }
    throw new Error((res as any).error || '导出失败')
  }, [query.filterPaper, query.filterStatus, debouncedSearch])

  // 初始化加载一次（试卷&统计）
  useEffect(() => {
    loadPapers()
    loadStats()
  }, [loadPapers, loadStats])

  // 查询变更时加载成绩
  useEffect(() => {
    loadResults()
  }, [loadResults])

  // 便捷 setter
  const setSearchTerm = (v: string) => setQuery(prev => ({ ...prev, searchTerm: v, page: 1 }))
  const setFilterPaper = (v: string) => setQuery(prev => ({ ...prev, filterPaper: v, page: 1 }))
  const setFilterStatus = (v: string) => setQuery(prev => ({ ...prev, filterStatus: v, page: 1 }))
  const setPage = (p: number) => setQuery(prev => ({ ...prev, page: Math.max(1, p) }))
  const setLimit = (l: number) => setQuery(prev => ({ ...prev, limit: Math.max(1, l), page: 1 }))

  // 展示辅助
  const statusClass = useCallback((s: string) => {
    if (s === 'completed') return 'text-green-600 bg-green-50'
    if (s === 'in_progress') return 'text-blue-600 bg-blue-50'
    if (s === 'not_started') return 'text-gray-600 bg-gray-50'
    return 'text-gray-600 bg-gray-50'
  }, [])
  const statusLabel = useCallback((s: string) => {
    if (s === 'completed') return '已完成'
    if (s === 'in_progress') return '进行中'
    if (s === 'not_started') return '未开始'
    return '未知'
  }, [])
  const scoreClass = useCallback((p: number) => {
    if (p >= 90) return 'text-green-600'
    if (p >= 80) return 'text-blue-600'
    if (p >= 60) return 'text-yellow-600'
    return 'text-red-600'
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
    statusClass,
    statusLabel,
    scoreClass,
  }
}
