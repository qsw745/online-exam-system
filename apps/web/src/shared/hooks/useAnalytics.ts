import { useQuery } from '@tanstack/react-query'
import dayjs from '@shared/utils/dayjs'
import { api, isSuccess } from '@shared/api/http'
import type { AnalyticsData } from '@features/analytics/types'

export type DateRange = [dayjs.Dayjs, dayjs.Dayjs] | null

export function useAnalytics(timeRange: DateRange, subject: string) {
  // 科目列表
  const subjectsQ = useQuery({
    queryKey: ['analytics', 'subjects'],
    queryFn: async () => {
      const res = await api.get<string[]>('/analytics/subjects')
      return isSuccess(res) ? res.data || [] : []
    },
    staleTime: 5 * 60 * 1000,
  })

  // 主数据
  const dataQ = useQuery({
    queryKey: [
      'analytics',
      'data',
      subject || 'all',
      timeRange?.[0]?.format('YYYY-MM-DD') || null,
      timeRange?.[1]?.format('YYYY-MM-DD') || null,
    ],
    queryFn: async () => {
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD'),
        end_date: timeRange?.[1]?.format('YYYY-MM-DD'),
        subject: subject && subject !== 'all' ? subject : undefined,
      }
      const res = await api.get<AnalyticsData>('/analytics', { params })
      // 后端统一响应：success/data
      if (isSuccess(res)) return (res.data || {}) as AnalyticsData
      throw new Error((res as any)?.error || '获取统计数据失败')
    },
    keepPreviousData: true,
  })

  return {
    subjects: subjectsQ.data || [],
    isLoading: dataQ.isLoading || subjectsQ.isLoading,
    isError: dataQ.isError,
    error: dataQ.error as Error | null,
    data: dataQ.data ?? null,
    refetch: dataQ.refetch,
  }
}
