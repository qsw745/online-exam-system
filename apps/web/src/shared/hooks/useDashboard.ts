import { useQueries } from '@tanstack/react-query'
import { dashboard, tasks, resultsApi, isSuccess } from '@shared/api/http'
import type { Stats, Task, Result } from '@features/dashboard/types'

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
          const res = await dashboard.getStats()
          if (isSuccess(res)) return { data: res.data as Stats, error: null }
          return { data: null, error: (res as any)?.error || 'stats error' }
        },
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ['tasks', 'recent', limit],
        queryFn: async (): Promise<QueryResult<Task[]>> => {
          const res = await tasks.list({ limit, sort: 'start_time' })
          if (isSuccess(res)) {
            const data = res.data as any
            const items: Task[] = Array.isArray(data) ? data : data?.tasks ?? []
            return { data: items, error: null }
          }
          return { data: [], error: (res as any)?.error || 'tasks error' }
        },
        staleTime: 3 * 60 * 1000,
      },
      {
        queryKey: ['results', 'recent', limit],
        queryFn: async (): Promise<QueryResult<Result[]>> => {
          const res = await resultsApi.list({ limit, sort: 'created_at' })
          if (isSuccess(res)) {
            const data = res.data as any
            const items: Result[] = Array.isArray(data) ? data : data?.results ?? []
            return { data: items, error: null }
          }
          return { data: [], error: (res as any)?.error || 'results error' }
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
