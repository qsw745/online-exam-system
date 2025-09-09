// src/shared/hooks/useDataAnalytics.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api, isSuccess } from '@/shared/api/http'

// —— 最小类型 —— //
export type Period = '7d' | '30d' | '90d' | 'custom' | string
export interface DataOverview {
  totalUsers: number
  activeUsers: number
  totalSubmissions: number
  averageScore: number
  [k: string]: any
}
export interface KnowledgePoint {
  id: number | string
  name: string
  value?: number
  [k: string]: any
}
export interface DifficultyDatum {
  difficulty: string
  count: number
}
export interface ActivityDatum {
  date: string
  value: number
}

export function useDataAnalytics(period: Period) {
  const overviewQ = useQuery<DataOverview>({
    queryKey: ['data-analytics', 'overview', period],
    queryFn: async () => {
      const res = await api.get<DataOverview>('/analytics/overview', { params: { period } })
      if (isSuccess(res)) return res.data || { totalUsers: 0, activeUsers: 0, totalSubmissions: 0, averageScore: 0 }
      throw new Error((res as any)?.error || '加载概览失败')
    },
    placeholderData: keepPreviousData, // ✅ v5
    staleTime: 5 * 60 * 1000,
  })

  const knowledgeQ = useQuery<KnowledgePoint[]>({
    queryKey: ['data-analytics', 'knowledge-points'],
    queryFn: async () => {
      const res = await api.get<KnowledgePoint[]>('/analytics/knowledge-points')
      if (isSuccess(res)) return res.data || []
      throw new Error((res as any)?.error || '加载知识点失败')
    },
    staleTime: 5 * 60 * 1000,
  })

  const difficultyQ = useQuery<DifficultyDatum[]>({
    queryKey: ['data-analytics', 'difficulty'],
    queryFn: async () => {
      const res = await api.get<DifficultyDatum[]>('/analytics/difficulty-distribution')
      if (isSuccess(res)) return res.data || []
      throw new Error((res as any)?.error || '加载难度分布失败')
    },
    staleTime: 5 * 60 * 1000,
  })

  const activityQ = useQuery<ActivityDatum[]>({
    queryKey: ['data-analytics', 'activity', period],
    queryFn: async () => {
      const res = await api.get<ActivityDatum[]>('/analytics/user-activity', { params: { period } })
      if (isSuccess(res)) return res.data || []
      throw new Error((res as any)?.error || '加载活跃度失败')
    },
    placeholderData: keepPreviousData, // ✅ v5
  })

  return {
    overview: overviewQ.data,
    knowledgePoints: knowledgeQ.data || [],
    difficulty: difficultyQ.data || [],
    activity: activityQ.data || [],
    isLoading: overviewQ.isLoading || knowledgeQ.isLoading || difficultyQ.isLoading || activityQ.isLoading,
    error:
      (overviewQ.error as Error) ||
      (knowledgeQ.error as Error) ||
      (difficultyQ.error as Error) ||
      (activityQ.error as Error) ||
      null,
    refetchAll: async () => {
      await Promise.all([overviewQ.refetch(), knowledgeQ.refetch(), difficultyQ.refetch(), activityQ.refetch()])
    },
  }
}

export default useDataAnalytics
