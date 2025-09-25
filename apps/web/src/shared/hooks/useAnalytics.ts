import { useQuery, keepPreviousData } from '@tanstack/react-query'
import dayjs from '@/shared/utils/dayjs'
import { api, isSuccess } from '@/shared/api/http'

export type DateRange = [dayjs.Dayjs, dayjs.Dayjs] | null

export interface AnalyticsData {
  overview: {
    total_students: number
    total_questions: number
    total_exams: number
    avg_score: number
    completion_rate: number
    active_students: number
  }
  subjects: Array<{ subject: string; questions_count: number; avg_score: number; completion_rate: number }>
  students: Array<{
    user_id: number | string
    username: string
    avg_score: number
    exams_completed: number
    total_score: number
    study_time: number
    last_active: string | null
  }>
}

const emptyData: AnalyticsData = {
  overview: {
    total_students: 0,
    total_questions: 0,
    total_exams: 0,
    avg_score: 0,
    completion_rate: 0,
    active_students: 0,
  },
  subjects: [{ subject: '未分组', questions_count: 0, avg_score: 0, completion_rate: 0 }],
  students: [],
}

export function useAnalytics(timeRange: DateRange, subject: string) {
  // 科目列表
  const subjectsQ = useQuery({
    queryKey: ['/analytics', 'subjects'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/subjects')
        // 兼容 { success, data } 或直接数组
        const data = (res as any)?.data?.data ?? (res as any)?.data ?? []
        return Array.isArray(data) ? (data as string[]) : []
      } catch {
        return [] as string[]
      }
    },
    staleTime: 5 * 60 * 1000,
  })

  // 主数据
  const dataQ = useQuery<AnalyticsData>({
    queryKey: [
      '/analytics',
      'data',
      subject || 'all',
      timeRange?.[0]?.format('YYYY-MM-DD') || null,
      timeRange?.[1]?.format('YYYY-MM-DD') || null,
    ],
    queryFn: async () => {
      const params = {
        start_date: timeRange?.[0]?.format('YYYY-MM-DD') || undefined,
        end_date: timeRange?.[1]?.format('YYYY-MM-DD') || undefined,
        subject: subject && subject !== 'all' ? subject : undefined,
      }
      const res = await api.get('/analytics', { params })
      // 兼容：Axios 默认把后端 JSON 放在 res.data
      const payload = (res as any)?.data
      const ok = (payload && payload.success === true) || isSuccess(res)

      if (ok) {
        const data = payload?.data ?? payload
        // 做一次形状校验，避免 undefined
        return {
          overview: {
            total_students: Number(data?.overview?.total_students || 0),
            total_questions: Number(data?.overview?.total_questions || 0),
            total_exams: Number(data?.overview?.total_exams || 0),
            avg_score: Number(data?.overview?.avg_score || 0),
            completion_rate: Number(data?.overview?.completion_rate || 0),
            active_students: Number(data?.overview?.active_students || 0),
          },
          subjects: Array.isArray(data?.subjects) ? data.subjects : emptyData.subjects,
          students: Array.isArray(data?.students) ? data.students : emptyData.students,
        } as AnalyticsData
      }

      // 非 ok：返回空数据而不是抛错，避免 ErrorBoundary
      return emptyData
    },
    placeholderData: keepPreviousData,
  })

  return {
    subjects: subjectsQ.data || [],
    isLoading: dataQ.isLoading || subjectsQ.isLoading,
    isError: false, // 我们把错误吞掉用空数据展示，页面不再炸
    error: null,
    data: dataQ.data ?? emptyData,
    refetch: dataQ.refetch,
  }
}

export default useAnalytics
