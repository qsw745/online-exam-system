import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, isSuccess, wrongQuestions as wqApi } from '@/shared/api/http'
import { translate } from '@/shared/utils/i18n'

export type WQFilter = 'unmastered' | 'mastered' | 'all'

export type WrongQuestion = {
  /** 错题记录ID（后端返回的 id，可选） */
  id?: number
  /** 题目ID */
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
  /** 正确率，0-100（从 correctRate 兼容为 number） */
  accuracy?: number
  /** 总练习次数（兼容 totalPractice 与 totalPractices） */
  totalPractices?: number
}

/** ====== 解析工具（容错） ====== */
const normalizeList = (payload: any): WrongQuestion[] => {
  const d = payload?.data ?? payload
  // 关键修复：加入 d.wrongQuestions
  const raw = d?.wrongQuestions ?? d?.items ?? d?.list ?? d?.rows ?? d?.questions ?? d?.data ?? []
  const arr: any[] = Array.isArray(raw) ? raw : []
  return arr.map(q => ({
    id: q?.id !== undefined ? Number(q.id) : undefined, // 记录ID（可用于某些删除接口）
    // 题目ID优先用 question_id；如果后端没给，再回退 id
    question_id: Number(q?.question_id ?? q?.qid ?? q?.question?.id ?? q?.id ?? 0),
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
  return Number(d?.total ?? d?.pagination?.total ?? d?.totalCount ?? fallback)
}

const normalizeStats = (payload: any): PracticeStats => {
  const d = payload?.data ?? payload ?? {}
  const accuracy =
    typeof d?.accuracy === 'number'
      ? d.accuracy
      : d?.correctRate !== undefined
      ? Number(d.correctRate) // "78.2" -> 78.2
      : undefined
  return {
    wrongQuestions: Number(d?.wrongQuestions ?? d?.wrong_questions ?? 0),
    masteredQuestions: Number(d?.masteredQuestions ?? d?.mastered_questions ?? 0),
    accuracy,
    totalPractices:
      typeof d?.totalPractices === 'number'
        ? d.totalPractices
        : typeof d?.totalPractice === 'number'
        ? d.totalPractice
        : undefined,
  }
}

/** ====== 使用封装好的 axios 请求（带后备路径的兼容） ====== */
const svc = {
  async list(params: { page?: number; limit?: number; filter?: WQFilter }) {
    const { page, limit, filter } = params
    const p: any = { page, limit }
    if (filter === 'mastered') p.mastered = true
    if (filter === 'unmastered') p.mastered = false

    try {
      // 首选新路由：/questions/wrong-questions
      const res = await wqApi.getWrongQuestions(p as any)
      const payload = (res as any)?.data ?? res
      const list = normalizeList(payload)
      const total = normalizeTotal(payload, list.length)
      return { list, total }
    } catch {
      // 兼容老路由：/wrong-questions?filter=...
      const fallbackParams: any = { page, limit }
      if (filter && filter !== 'all') fallbackParams.filter = filter
      const r2 = await api.get('/wrong-questions', { params: fallbackParams })
      const payload2 = (r2 as any)?.data ?? r2
      const list = normalizeList(payload2)
      const total = normalizeTotal(payload2, list.length)
      return { list, total }
    }
  },

  async stats(): Promise<PracticeStats> {
    try {
      const res = await wqApi.getPracticeStats()
      const payload = (res as any)?.data ?? res
      return normalizeStats(payload)
    } catch {
      // 兼容老路由
      const r2 = await api.get('/wrong-questions/stats')
      const payload2 = (r2 as any)?.data ?? r2
      return normalizeStats(payload2)
    }
  },

  async markMastered(qidOrRid: number) {
    // 有的后端要“记录ID”，有的要“题目ID”；依次尝试
    try {
      const r = await wqApi.markAsMastered(qidOrRid) // PUT /questions/wrong-questions/:id/mastered
      if (isSuccess(r)) return true
    } catch {}
    try {
      await api.post('/wrong-questions/mark-mastered', { question_id: qidOrRid })
      return true
    } catch {}
    try {
      await api.put(`/wrong-questions/${qidOrRid}/mastered`)
      return true
    } catch {}
    try {
      await api.post('/wrong-questions/mark', { question_id: qidOrRid, mastered: true })
      return true
    } catch {}
    return false
  },

  async remove(qidOrRid: number) {
    // 先按记录ID删；失败再按题目ID删
    try {
      const r = await wqApi.removeFromWrongQuestions(qidOrRid) // DELETE /questions/wrong-questions/:id
      if (isSuccess(r)) return true
    } catch {}
    try {
      await api.delete(`/wrong-questions/${qidOrRid}`)
      return true
    } catch {}
    try {
      await api.post('/wrong-questions/remove', { question_id: qidOrRid })
      return true
    } catch {}
    return false
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
        const { list, total } = await svc.list({ page: p, limit: pageSize, filter })
        setList(list)
        setTotal(total)
        setPage(p)
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || translate('auto.4096ebd1fe'))
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
      const s = await svc.stats()
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
    message.success(translate('auto.519b29552c'))
  }, [loadList, loadStats, page, message])

  const markMastered = useCallback(
    async (qidOrRid: number) => {
      const prev = list
      const next = prev.map(q => (q.question_id === qidOrRid || q.id === qidOrRid ? { ...q, is_mastered: true } : q))
      setList(next)
      const prevStats = stats
      if (prevStats) {
        const wasUnmastered = prev.some(q => (q.question_id === qidOrRid || q.id === qidOrRid) && !q.is_mastered)
        setStats({
          ...prevStats,
          masteredQuestions: prevStats.masteredQuestions + (wasUnmastered ? 1 : 0),
          wrongQuestions: Math.max(0, prevStats.wrongQuestions - 0),
        })
      }
      try {
        const ok = await svc.markMastered(qidOrRid)
        if (!ok) throw new Error('failed')
      } catch (e: any) {
        setList(prev) // 回滚
        if (prevStats) setStats(prevStats)
        message.error(e?.message || translate('app.operation_failed'))
      }
    },
    [list, stats, message]
  )

  const remove = useCallback(
    async (qidOrRid: number) => {
      const prev = list
      const next = prev.filter(q => q.question_id !== qidOrRid && q.id !== qidOrRid)
      setList(next)
      const prevStats = stats
      if (prevStats) {
        const removed = prev.find(q => q.question_id === qidOrRid || q.id === qidOrRid)
        setStats({
          ...prevStats,
          wrongQuestions: Math.max(0, prevStats.wrongQuestions - (removed ? 1 : 0)),
          masteredQuestions: Math.max(0, prevStats.masteredQuestions - (removed?.is_mastered ? 1 : 0)),
        })
      }
      try {
        const ok = await svc.remove(qidOrRid)
        if (!ok) throw new Error('failed')
        message.success(translate('auto.298b7582b3'))
        if (next.length === 0 && page > 1) loadList(page - 1)
      } catch (e: any) {
        setList(prev) // 回滚
        if (prevStats) setStats(prevStats)
        message.error(e?.message || translate('app.operation_failed'))
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
