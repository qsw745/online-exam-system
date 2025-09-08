import { useCallback, useEffect, useMemo, useState } from 'react'
import { App } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { leaderboardApi, type LeaderboardEntry, type LeaderboardStats } from '@shared/api/endpoints/leaderboard'

export type LeaderboardTab = 'overall' | 'study_time' | 'accuracy'

export function useLeaderboard() {
  const { message } = App.useApp()

  // tabs / 基础
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('overall')

  // 顶部筛选
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([dayjs().subtract(30, 'day'), dayjs()])
  const [subjects, setSubjects] = useState<string[]>([])
  const [selectedSubject, setSelectedSubject] = useState('all')

  // 榜单选择
  const [boards, setBoards] = useState<{ id: number; name: string }[]>([])
  const [boardId, setBoardId] = useState<number | null>(null)

  // 表格数据
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)

  // 统计卡片
  const [stats, setStats] = useState<LeaderboardStats | null>(null)

  // 分页（前端切片；若后端分页，直接把 page / limit 传给接口）
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return entries.slice(start, end)
  }, [entries, page, pageSize])

  const fetchBoards = useCallback(async () => {
    try {
      setLoading(true)
      const list = await leaderboardApi.listLeaderboards({
        category: 'all',
        type: activeTab === 'overall' ? 'all' : activeTab,
        active: true,
      })
      setBoards(list)
      if (list.length > 0 && !boardId) setBoardId(list[0].id)
    } catch (e) {
      message.error('获取排行榜列表失败')
      setBoards([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, boardId, message])

  const fetchEntries = useCallback(async () => {
    if (!boardId) return
    try {
      setLoading(true)
      const { items, total } = await leaderboardApi.getLeaderboard(boardId, {
        subject: selectedSubject,
        start: timeRange?.[0],
        end: timeRange?.[1],
      })
      setEntries(items)
      setTotalItems(total)
      setPage(1) // 每次筛选切回第1页
    } catch (e) {
      message.error('获取排行榜数据失败，已使用兜底数据')
      setEntries([
        {
          id: 1,
          user_id: 1,
          username: '张三',
          score: 95.5,
          rank: 1,
          total_questions: 100,
          correct_questions: 95,
          study_time: 120,
          streak_days: 15,
        },
        {
          id: 2,
          user_id: 2,
          username: '李四',
          score: 92.0,
          rank: 2,
          total_questions: 100,
          correct_questions: 92,
          study_time: 110,
          streak_days: 12,
        },
        {
          id: 3,
          user_id: 3,
          username: '王五',
          score: 89.5,
          rank: 3,
          total_questions: 100,
          correct_questions: 89,
          study_time: 105,
          streak_days: 8,
        },
      ])
      setTotalItems(3)
    } finally {
      setLoading(false)
    }
  }, [boardId, selectedSubject, timeRange, message])

  const fetchStats = useCallback(async () => {
    const s = await leaderboardApi.getStats()
    setStats(s)
  }, [])

  const fetchSubjects = useCallback(async () => {
    const list = await leaderboardApi.getSubjects()
    setSubjects(list)
  }, [])

  // 初始化
  useEffect(() => {
    fetchBoards()
    fetchStats()
    fetchSubjects()
  }, [fetchBoards, fetchStats, fetchSubjects])
  // tab 变化 -> 重新拉榜单列表
  useEffect(() => {
    fetchBoards()
  }, [activeTab]) // boardId 会在 fetchBoards 内处理
  // 选中榜单 / 筛选变化 -> 拉数据
  useEffect(() => {
    if (boardId) fetchEntries()
  }, [boardId, selectedSubject, timeRange, fetchEntries])

  return {
    // state
    activeTab,
    setActiveTab,
    subjects,
    selectedSubject,
    setSelectedSubject,
    timeRange,
    setTimeRange,
    boards,
    boardId,
    setBoardId,
    stats,
    loading,

    // table
    entries,
    pageData,
    totalItems,
    page,
    pageSize,
    setPage,
    setPageSize,

    // actions
    refresh: () => {
      fetchEntries()
      fetchStats()
    },
  }
}

export default useLeaderboard
