/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, useCallback } from 'react'
import { api, isSuccess, questionsApi } from '@/shared/api/http'
import { useDebounce } from '@/shared/hooks/useDebounce'
import type { ApiResult as CoreApiResult } from '@/shared/api/core/types'

export interface QuestionListItem {
  id: string | number
  content?: string
  difficulty?: string
  question_type?: string
  // 兼容你的卡片组件
  title?: string
  type?: string
}

export type Difficulty = 'all' | 'easy' | 'medium' | 'hard'
/** ✅ 多选题型 */
export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer'

function asApiResult<T = any>(res: any): CoreApiResult<T> {
  const d = (res as any)?.data ?? res
  if (d && typeof d === 'object' && ('success' in d || 'data' in d || 'error' in d)) {
    return d as CoreApiResult<T>
  }
  // 兜底成成功结构
  return { success: true, data: d } as unknown as CoreApiResult<T>
}

export function usePracticeList() {
  const [search, setSearch] = useState('')
  /** ✅ 多选题型：默认空数组表示“全部类型” */
  const [types, setTypes] = useState<QuestionType[]>([])
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
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim()
    if (difficulty !== 'all') {
      p.difficulty = difficulty
      p.level = difficulty // 若后端用 level
    }
    if (selectedTags.length) p.tags = selectedTags.join(',')

    // ✅ 多选题型：数组 + CSV 双通道（后端读其一）
    if (types.length) {
      p.types = types // axios 序列化为 ?types=a&types=b
      p.types_csv = types.join(',') // 兼容 ?types_csv=a,b
    }

    return p
  }, [page, pageSize, debouncedSearch, difficulty, selectedTags, types])

  const reloadTags = useCallback(async () => {
    try {
      const r = await questionsApi.getTags()
      const d = asApiResult<string[]>(r)
      if (isSuccess(d) && Array.isArray((d as any).data)) setAllTags((d as any).data)
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
        // 兼容多种返回：数组 / { items } / { list } / { questions }
        const items: any[] = Array.isArray(d) ? d : d?.items ?? d?.list ?? d?.questions ?? []
        const totalFromApi =
          (d?.total as number) ?? (d?.totalQuestions as number) ?? (d?.pagination?.total as number) ?? items.length

        // ✅ 兼容卡片组件字段
        const normalized = (items ?? []).map((it: any) => ({
          id: it.id ?? it.question_id,
          title: it.title ?? it.content ?? it.stem,
          type: it.type ?? it.question_type, // 给 QuestionCardGrid 用
          question_type: it.question_type ?? it.type, // 也保留原字段
          difficulty: it.difficulty ?? it.level,
          ...it,
        }))
        const seen = new Set<string>()
        const deduped = normalized.filter(it => {
          const keySource = it.content_hash ?? it.content ?? it.title ?? it.id
          const key = `${it.question_type ?? it.type ?? ''}::${String(keySource || '')}`.trim()
          if (!key) return true
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        if (!mounted) return
        setList(deduped)
        setTotal(Number(totalFromApi || deduped.length))
      } catch (e: any) {
        if (!mounted) return
        setList([])
        setTotal(0)
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
  }, [types, difficulty, debouncedSearch, selectedTags])

  return {
    list,
    total,
    page,
    pageSize,
    loading,
    error,

    /** ✅ 多选题型 */
    types,
    setTypes,

    difficulty,
    setDifficulty,

    search,
    setSearch,

    selectedTags,
    setSelectedTags,

    allTags,

    setPage,
    setPageSize,
  }
}
