// features/wrong-questions/hooks/useWrongQuestions.ts
import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { wqService, type WQFilter, type WrongQuestion, type PracticeStats } from '../services/wq.service'

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
        const { list, total } = await wqService.list({ page: p, limit: pageSize, filter })
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
      const s = await wqService.stats()
      setStats(s)
    } catch (e) {
      // 静默
    }
  }, [])

  // 过滤变更时回到第一页
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
      // 同步统计
      const prevStats = stats
      if (prevStats) {
        setStats({
          ...prevStats,
          masteredQuestions:
            prevStats.masteredQuestions + (prev.find(q => q.question_id === qid && !q.is_mastered) ? 1 : 0),
          wrongQuestions: Math.max(0, prevStats.wrongQuestions - 0), // 不从错题集中删除，仅状态变更
        })
      }
      try {
        await wqService.markMastered(qid)
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
        await wqService.remove(qid)
        message.success('已从错题本移除')
        // 若当前页被删空且不是第一页，自动回退一页
        if (next.length === 0 && page > 1) loadList(page - 1)
      } catch (e: any) {
        setList(prev) // 回滚
        if (prevStats) setStats(prevStats)
        message.error(e?.message || '操作失败')
      }
    },
    [list, stats, page, loadList, message]
  )

  const onPageChange = useCallback(
    (p: number) => {
      loadList(p)
    },
    [loadList]
  )

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
