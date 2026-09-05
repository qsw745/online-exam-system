import { App } from 'antd'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isSuccess, wrongQuestions as wqApi } from '@/shared/api/http'
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
    is_mastered: [true, 1, '1', 'true'].includes(q?.is_mastered ?? q?.mastered ?? false),
    content: q?.content ?? '',
    wrong_count: Number(q?.wrong_count ?? q?.wrongCount ?? 0),
    correct_count: Number(q?.correct_count ?? q?.correctCount ?? 0),
    last_practice_time: q?.last_practice_time ?? q?.lastPracticeTime ?? '',
  }))
}

const normalizeTotal = (payload: any, fallback = 0) => {
  const d = payload?.data ?? payload
  const total = Number(d?.total ?? d?.pagination?.total ?? d?.totalCount ?? fallback)
  return Number.isFinite(total) && total >= 0 ? total : fallback
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
    accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.min(100, accuracy!)) : undefined,
    totalPractices:
      typeof d?.totalPractices === 'number'
        ? d.totalPractices
        : typeof d?.totalPractice === 'number'
        ? d.totalPractice
        : undefined,
  }
}

/** 当前服务以题目 ID 操作错题。失败不会改用含义不同的旧端点重试写入。 */
const svc = {
  async list(page: number, limit: number, filter: WQFilter) {
    const res = await wqApi.getWrongQuestions({ page, limit, mastered: filter === 'all' ? undefined : filter === 'mastered' })
    if (!isSuccess(res)) throw new Error(res.error || '错题加载失败')
    const list = normalizeList(res.data)
    return { list, total: normalizeTotal(res.data, list.length) }
  },
  async stats() {
    const res = await wqApi.getPracticeStats()
    if (!isSuccess(res)) throw new Error(res.error || '练习统计加载失败')
    return normalizeStats(res.data)
  },
}

export function useWrongQuestions(initialFilter: WQFilter = 'unmastered') {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [filter, setFilterValue] = useState<WQFilter>(initialFilter)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [list, setList] = useState<WrongQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const pendingRef = useRef(new Set<number>())
  const mounted = useRef(false)
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const listVersion = useRef(0)
  const statsVersion = useRef(0)
  const currentView = useRef({ filter, page })
  useLayoutEffect(() => { currentView.current = { filter, page } }, [filter, page])

  const loadList = useCallback(async function fetchPage(requestedPage = 1, requestedFilter = filter): Promise<boolean> {
    const version = ++listVersion.current
    setLoading(true)
    setError(null)
    try {
      const result = await svc.list(requestedPage, pageSize, requestedFilter)
      if (version !== listVersion.current) return false
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
      if (requestedPage > lastPage) return fetchPage(lastPage, requestedFilter)
      setList(result.list)
      setTotal(result.total)
      setPage(requestedPage)
      return true
    } catch (error) {
      if (version === listVersion.current) {
        setList([])
        setTotal(0)
        setError(error instanceof Error ? error.message : '错题加载失败')
      }
      return false
    } finally {
      if (version === listVersion.current) setLoading(false)
    }
  }, [filter])

  const loadStats = useCallback(async () => {
    const version = ++statsVersion.current
    try {
      const data = await svc.stats()
      if (version !== statsVersion.current) return false
      setStats(data)
      setStatsError(null)
      return true
    } catch (error) {
      if (version === statsVersion.current) setStatsError(error instanceof Error ? error.message : '练习统计加载失败')
      return false
    }
  }, [])

  useEffect(() => {
    void loadList(1)
    return () => { listVersion.current += 1 }
  }, [loadList])
  useEffect(() => {
    void loadStats()
    return () => { statsVersion.current += 1 }
  }, [loadStats])

  const setFilter = useCallback((next: WQFilter) => {
    if (next === filter) return
    listVersion.current += 1
    setList([])
    setPage(1)
    setFilterValue(next)
  }, [filter])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const results = await Promise.all([loadList(page), loadStats()])
    setRefreshing(false)
    if (results.every(Boolean)) message.success(translate('auto.519b29552c'))
  }, [loadList, loadStats, page, message])

  const mutate = useCallback(async (qid: number, action: 'master' | 'remove') => {
    if (!Number.isSafeInteger(qid) || qid <= 0 || pendingRef.current.has(qid)) return
    pendingRef.current.add(qid)
    setPendingIds(new Set(pendingRef.current))
    try {
      const res = action === 'master' ? await wqApi.markAsMastered(qid) : await wqApi.removeFromWrongQuestions(qid)
      if (!mounted.current) return
      if (!isSuccess(res)) throw new Error(res.error || '操作失败，请重试')
      message.success(action === 'master' ? '已标记为掌握' : translate('auto.298b7582b3'))
      const current = currentView.current
      await Promise.all([loadList(current.page, current.filter), loadStats()])
    } catch (error) {
      if (mounted.current) message.error(error instanceof Error ? error.message : translate('app.operation_failed'))
    } finally {
      pendingRef.current.delete(qid)
      if (mounted.current) setPendingIds(new Set(pendingRef.current))
    }
  }, [loadList, loadStats, message])
  const markMastered = useCallback((id: number) => mutate(id, 'master'), [mutate])
  const remove = useCallback((id: number) => mutate(id, 'remove'), [mutate])
  const onPageChange = useCallback((page: number) => loadList(page), [loadList])
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total])

  return { loading, refreshing, error, statsError, filter, list, stats, page, pageSize, total, totalPages,
    pendingIds, setFilter, refresh, markMastered, remove, onPageChange }
}
