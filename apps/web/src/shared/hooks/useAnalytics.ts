import { useQuery, keepPreviousData } from '@tanstack/react-query'
import dayjs from '@shared/utils/dayjs'
import { api, isSuccess } from '@shared/api/http'

export type DateRange = [dayjs.Dayjs, dayjs.Dayjs] | null

// 若你有正式类型可替换；这里给一个安全的兜底
export interface AnalyticsData {
  overview?: Record<string, any>
  trend?: Array<{ date: string; value: number }>
  subjects?: string[]
  [k: string]: any
}

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
  const dataQ = useQuery<AnalyticsData>({
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
      if (isSuccess(res)) return (res.data || {}) as AnalyticsData
      throw new Error((res as any)?.error || '获取统计数据失败')
    },
    placeholderData: keepPreviousData, // ✅ v5 的写法
  })

  return {
    subjects: subjectsQ.data || [],
    isLoading: dataQ.isLoading || subjectsQ.isLoading,
    isError: dataQ.isError,
    error: (dataQ.error as Error) ?? null,
    data: dataQ.data ?? null,
    refetch: dataQ.refetch,
  }
}

export default useAnalytics
