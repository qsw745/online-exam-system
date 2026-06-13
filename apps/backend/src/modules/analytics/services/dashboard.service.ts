// apps/backend/src/modules/analytics/services/dashboard.service.ts
import { pool } from '@/config/database.js'
import type { ITaskStats, IScoreStats, DashboardStatsData } from '../domain/dashboard.model'

let RC: any = null
;(async () => {
  try {
    const mod: any = await import('@/common/redis/cache')
    RC = mod?.default ?? mod
  } catch {}
})()

const DASH_TTL = 180
const kDash = (uid: number) => `analytics:dashboard:${uid}`

async function cget<T = any>(k: string) {
  try {
    const v = await RC?.get?.(k)
    return v ? JSON.parse(v) : null
  } catch {
    return null
  }
}
async function cset(k: string, v: any, ttl = DASH_TTL) {
  try {
    await RC?.set?.(k, JSON.stringify(v), ttl)
  } catch {}
}

export class DashboardService {
  async getStats(userId: number): Promise<DashboardStatsData> {
    const ck = kDash(userId)
    const hit = await cget(ck)
    if (hit) return hit

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

    const data: DashboardStatsData = {
      total_tasks: taskStats[0]?.total_tasks || 0,
      completed_tasks: taskStats[0]?.completed_tasks || 0,
      average_score: scoreStats[0]?.average_score || 0,
      best_score: scoreStats[0]?.best_score || 0,
    }
    await cset(ck, data, 180)
    return data
  }
}
