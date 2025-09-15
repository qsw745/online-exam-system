import { useEffect, useMemo, useState, useCallback } from 'react'
import { api, isSuccess, questionsApi } from '@/shared/api/http'
import { useDebounce } from '@/shared/hooks/useDebounce'

export interface QuestionListItem {
  id: string | number
  content?: string
  difficulty?: string
  question_type?: string
}

export type QuestionType = 'all' | 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'
export type Difficulty = 'all' | 'easy' | 'medium' | 'hard'

interface ApiResult<T> {
  success: boolean
  data: T
  error?: any
}

function asApiResult<T = any>(res: any): ApiResult<T> {
  const d = res?.data ?? res
  if (d && typeof d === 'object' && ('success' in d || 'data' in d || 'error' in d)) return d as ApiResult<T>
  return { success: true, data: d } as unknown as ApiResult<T>
}

export function usePracticeList() {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<QuestionType>('all')
  const [difficulty, setDifficulty] = useState<Difficulty>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [list, setList] = useState<QuestionListItem[]>([])
  const [total, setTotal] = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  const params = useMemo(() => {
    const p: any = { page, limit: pageSize }
    if (debouncedSearch.trim()) {
      p.search = debouncedSearch.trim()
    }
    if (type !== 'all') {
      p.type = type
      p.question_type = type
    }
    if (difficulty !== 'all') {
      p.difficulty = difficulty
      p.level = difficulty
    }
    if (selectedTags.length) {
      p.tags = selectedTags.join(',')
    }
    return p
  }, [page, pageSize, debouncedSearch, type, difficulty, selectedTags])

  const reloadTags = useCallback(async () => {
    try {
      const r = await questionsApi.getTags()
      if (isSuccess(r) && Array.isArray(r.data)) setAllTags(r.data)
      else setAllTags([])
    } catch {
      setAllTags([])
    }
  }, [])

  useEffect(() => {
    reloadTags()
  }, [reloadTags])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const r = await api.get('/questions', { params })
        const norm = asApiResult<any>(r)
        if (!isSuccess(norm)) throw new Error((norm as any).error || '获取题目失败')

        const d = norm.data as any
        const items: QuestionListItem[] = Array.isArray(d) ? d : d?.questions ?? d?.items ?? []
        const totalFromApi =
          (d?.total as number) ?? (d?.totalQuestions as number) ?? (d?.pagination?.total as number) ?? items.length

        if (!mounted) return
        setList(items)
        setTotal(Number(totalFromApi || items.length))
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || '获取题目失败')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [params])

  // 任一筛选变化回到第一页
  useEffect(() => {
    setPage(1)
  }, [type, difficulty, debouncedSearch, selectedTags])

  return {
    list,
    total,
    page,
    pageSize,
    loading,
    error,
    type,
    difficulty,
    search,
    selectedTags,
    allTags,
    setType,
    setDifficulty,
    setSearch,
    setSelectedTags,
    setPage,
    setPageSize,
  }
}
