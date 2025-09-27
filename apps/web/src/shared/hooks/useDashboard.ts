// src/shared/hooks/useDashboard.ts
import { useQueries } from '@tanstack/react-query'
import { dashboard, tasksApi, resultsApi, isSuccess } from '@/shared/api/http'

// 本地声明最小类型，避免依赖 features 下的 types
export interface Stats {
  total_tasks: number
  completed_tasks: number
  average_score: number
  best_score: number
}
export interface Task {
  id: string
  title: string
  description?: string
  start_time?: string
  end_time?: string
  status?: string
  assigned_users?: Array<{ id: string | number; name: string }>
  created_at?: string
}
export interface Result {
  id: string
  user_id?: string | number
  score?: number
  created_at?: string
}

type QueryResult<T> = {
  data: T | null
  error: string | null
}

export function useDashboard(limit = 5) {
  const queries = useQueries({
    queries: [
      {
        queryKey: ['dashboard', 'stats'],
        queryFn: async (): Promise<QueryResult<Stats>> => {
          const res: any = await dashboard.getStats()
          if (isSuccess(res)) return { data: (res.data as Stats) ?? null, error: null }
          return { data: null, error: res?.error || 'stats error' }
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['tasks', 'recent', limit],
        queryFn: async (): Promise<QueryResult<Task[]>> => {
          // 后端类型不支持 sort，去掉 sort 以避免 TS 报错
          const res: any = await tasksApi.listMine({ limit })
          if (isSuccess(res)) {
            const data = res.data as any
            const items: Task[] = Array.isArray(data) ? data : data?.tasks ?? []
            return { data: items, error: null }
          }
          return { data: [], error: res?.error || 'tasks error' }
        },
        staleTime: 3 * 60 * 1000,
      },
      {
        queryKey: ['results', 'recent', limit],
        queryFn: async (): Promise<QueryResult<Result[]>> => {
          const res: any = await resultsApi.list({ limit })
          if (isSuccess(res)) {
            const data = res.data as any
            const items: Result[] = Array.isArray(data) ? data : data?.results ?? []
            return { data: items, error: null }
          }
          return { data: [], error: res?.error || 'results error' }
        },
        staleTime: 3 * 60 * 1000,
      },
    ],
  })

  const [statsQ, tasksQ, resultsQ] = queries

  const isLoading = queries.some(q => q.isLoading)
  const isError = queries.some(q => q.isError)

  const stats: Stats = statsQ.data?.data ?? {
    total_tasks: 0,
    completed_tasks: 0,
    average_score: 0,
    best_score: 0,
  }
  const recentTasks: Task[] = tasksQ.data?.data ?? []
  const recentResults: Result[] = resultsQ.data?.data ?? []

  const errorMessages = [statsQ.data?.error, tasksQ.data?.error, resultsQ.data?.error].filter(Boolean) as string[]

  const refetchAll = () => queries.forEach(q => q.refetch())

  return { stats, recentTasks, recentResults, isLoading, isError, errorMessages, refetchAll }
}

export default useDashboard
