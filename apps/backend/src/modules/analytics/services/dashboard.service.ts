import { pool } from '@config/database.js'
import type { ITaskStats, IScoreStats, DashboardStatsData } from '../domain/dashboard.model'

export class DashboardService {
  async getStats(userId: number): Promise<DashboardStatsData> {
    const [taskStats] = await pool.query<ITaskStats[]>(
      `SELECT 
         COUNT(DISTINCT t.id) AS total_tasks,
         SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks
       FROM tasks t
       JOIN task_assignments ta ON t.id = ta.task_id
       WHERE ta.user_id = ?`,
      [userId]
    )

    const [scoreStats] = await pool.query<IScoreStats[]>(
      `SELECT 
         ROUND(AVG(score), 2) AS average_score,
         MAX(score) AS best_score
       FROM exam_results 
       WHERE user_id = ?`,
      [userId]
    )

    return {
      total_tasks: taskStats[0]?.total_tasks || 0,
      completed_tasks: taskStats[0]?.completed_tasks || 0,
      average_score: scoreStats[0]?.average_score || 0,
      best_score: scoreStats[0]?.best_score || 0,
    }
  }
}
