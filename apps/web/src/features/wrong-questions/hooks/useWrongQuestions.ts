// apps/web/src/features/wrong-questions/hooks/useWrongQuestions.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

// ====== 本地最小类型，避免依赖已删除的 service ======
export type WQFilter = 'unmastered' | 'mastered' | 'all'

export type WrongQuestion = {
  question_id: number
  question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  is_mastered: boolean
  content: string
  wrong_count: number
  correct_count: number
  last_practice_time: string
}

export type PracticeStats = {
  wrongQuestions: number
  masteredQuestions: number
  accuracy?: number
  totalPractices?: number
}

// ====== 轻量工具函数 ======
const qs = (obj: Record<string, any>) =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as any)}`)
    .join('&')

const toJson = async (res: Response) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // 兼容某些接口返回空
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const normalizeList = (payload: any): WrongQuestion[] => {
  const d = payload?.data ?? payload
  const raw = (Array.isArray(d) ? d : d?.items ?? d?.list ?? d?.rows ?? d?.questions ?? d?.data) ?? []
  const arr: any[] = Array.isArray(raw) ? raw : []
  return arr.map(q => ({
    question_id: Number(q?.question_id ?? q?.id ?? 0),
    question_type: q?.question_type ?? q?.type ?? 'single_choice',
    is_mastered: !!(q?.is_mastered ?? q?.mastered ?? false),
    content: q?.content ?? '',
    wrong_count: Number(q?.wrong_count ?? q?.wrongCount ?? 0),
    correct_count: Number(q?.correct_count ?? q?.correctCount ?? 0),
    last_practice_time: q?.last_practice_time ?? q?.lastPracticeTime ?? new Date().toISOString(),
  }))
}

const normalizeTotal = (payload: any, fallback = 0) => {
  const d = payload?.data ?? payload
  return Number(d?.total ?? d?.pagination?.total ?? fallback)
}

const normalizeStats = (payload: any): PracticeStats => {
  const d = payload?.data ?? payload ?? {}
  return {
    wrongQuestions: Number(d?.wrongQuestions ?? d?.wrong_questions ?? 0),
    masteredQuestions: Number(d?.masteredQuestions ?? d?.mastered_questions ?? 0),
    accuracy: typeof d?.accuracy === 'number' ? d.accuracy : undefined,
    totalPractices: typeof d?.totalPractices === 'number' ? d.totalPractices : undefined,
  }
}

// ====== 直接用 fetch 调后端（不依赖 service/SDK） ======
const api = {
  async list(params: { page?: number; limit?: number; filter?: WQFilter }) {
    const url = `/wrong-questions?${qs(params)}`
    const res = await fetch(url, { credentials: 'include' })
    const data = await toJson(res)
    const list = normalizeList(data)
    const total = normalizeTotal(data, list.length)
    return { list, total }
  },
  async stats(): Promise<PracticeStats> {
    const res = await fetch('/wrong-questions/stats', { credentials: 'include' })
    const data = await toJson(res)
    return normalizeStats(data)
  },
  async markMastered(qid: number) {
    // 优先新接口；失败则尝试兼容老接口
    try {
      const r = await fetch('/wrong-questions/mark-mastered', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: qid }),
      })
      if (r.ok) return true
    } catch {}
    try {
      const r2 = await fetch(`/wrong-questions/${qid}/mastered`, {
        method: 'PUT',
        credentials: 'include',
      })
      if (r2.ok) return true
    } catch {}
    const r3 = await fetch('/wrong-questions/mark', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: qid, mastered: true }),
    })
    return r3.ok
  },
  async remove(qid: number) {
    try {
      const r = await fetch(`/wrong-questions/${qid}`, { method: 'DELETE', credentials: 'include' })
      if (r.ok) return true
    } catch {}
    const r2 = await fetch('/wrong-questions/remove', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: qid }),
    })
    return r2.ok
  },
}

export function useWrongQuestions(initialFilter: WQFilter = 'unmastered') {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [filter, setFilter] = useState<WQFilter>(initialFilter)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)

  const [list, setList] = useState<WrongQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<PracticeStats | null>(null)

  const loadList = useCallback(
    async (p = 1) => {
      setLoading(true)
      try {
        const { list, total } = await api.list({ page: p, limit: pageSize, filter })
        setList(list)
        setTotal(total)
        setPage(p)
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载错题本失败')
        setList([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [filter, pageSize, message]
  )

  const loadStats = useCallback(async () => {
    try {
      const s = await api.stats()
      setStats(s)
    } catch {
      // 静默
    }
  }, [])

  useEffect(() => {
    loadList(1)
    loadStats()
  }, [filter, loadList, loadStats])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadList(page), loadStats()])
    setRefreshing(false)
    message.success('数据已刷新')
  }, [loadList, loadStats, page, message])

  // 乐观：标记已掌握
  const markMastered = useCallback(
    async (qid: number) => {
      const prev = list
      const next = prev.map(q => (q.question_id === qid ? { ...q, is_mastered: true } : q))
      setList(next)
      const prevStats = stats
      if (prevStats) {
        setStats({
          ...prevStats,
          masteredQuestions:
            prevStats.masteredQuestions + (prev.find(q => q.question_id === qid && !q.is_mastered) ? 1 : 0),
          wrongQuestions: Math.max(0, prevStats.wrongQuestions - 0),
        })
      }
      try {
        const ok = await api.markMastered(qid)
        if (!ok) throw new Error('failed')
      } catch (e: any) {
        setList(prev) // 回滚
        if (prevStats) setStats(prevStats)
        message.error(e?.message || '操作失败')
      }
    },
    [list, stats, message]
  )

  // 乐观：移除
  const remove = useCallback(
    async (qid: number) => {
      const prev = list
      const next = prev.filter(q => q.question_id !== qid)
      setList(next)
      const prevStats = stats
      if (prevStats) {
        setStats({
          ...prevStats,
          wrongQuestions: Math.max(0, prevStats.wrongQuestions - 1),
          masteredQuestions: Math.max(
            0,
            prevStats.masteredQuestions - (prev.find(q => q.question_id === qid)?.is_mastered ? 1 : 0)
          ),
        })
      }
      try {
        const ok = await api.remove(qid)
        if (!ok) throw new Error('failed')
        message.success('已从错题本移除')
        if (next.length === 0 && page > 1) loadList(page - 1)
      } catch (e: any) {
        setList(prev) // 回滚
        if (prevStats) setStats(prevStats)
        message.error(e?.message || '操作失败')
      }
    },
    [list, stats, page, loadList, message]
  )

  const onPageChange = useCallback((p: number) => loadList(p), [loadList])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  return {
    // state
    loading,
    refreshing,
    filter,
    list,
    stats,
    page,
    pageSize,
    total,
    totalPages,
    // actions
    setFilter,
    refresh,
    markMastered,
    remove,
    onPageChange,
  }
}
