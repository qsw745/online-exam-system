import { api } from '../core/httpClient'

export const dashboard = {
  getStats: () =>
    api
      .get<{ total_tasks: number; completed_tasks: number; average_score: number; best_score: number }>(
        '/dashboard/stats'
      )
      .then(res =>
        res.success
          ? res
          : { success: true, data: { total_tasks: 0, completed_tasks: 0, average_score: 0, best_score: 0 } as const }
      ),
}
