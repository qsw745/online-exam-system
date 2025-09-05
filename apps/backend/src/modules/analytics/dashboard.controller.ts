import type { Response } from 'express'
import type { RowDataPacket } from 'mysql2'
import { pool } from '@config/database.js'
import type { AuthRequest } from '../../types/auth.js'
import type { ApiResponse } from '../../types/response.js'

interface ITaskStats extends RowDataPacket {
  total_tasks: number
  completed_tasks: number
}

interface IScoreStats extends RowDataPacket {
  average_score: number
  best_score: number
}

type DashboardStatsData = {
  total_tasks: number
  completed_tasks: number
  average_score: number
  best_score: number
}

export class DashboardController {
  static async getStats(req: AuthRequest, res: Response<ApiResponse<DashboardStatsData>>) {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({ success: false, error: '未授权' })
      }

      // 任务统计
      const [taskStats] = await pool.query<ITaskStats[]>(
        `SELECT 
          COUNT(DISTINCT t.id) AS total_tasks,
          SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks
        FROM tasks t
        JOIN task_assignments ta ON t.id = ta.task_id
        WHERE ta.user_id = ?`,
        [userId]
      )

      // 成绩统计
      const [scoreStats] = await pool.query<IScoreStats[]>(
        `SELECT 
          ROUND(AVG(score), 2) AS average_score,
          MAX(score) AS best_score
        FROM exam_results 
        WHERE user_id = ?`,
        [userId]
      )

      return res.json({
        success: true,
        data: {
          total_tasks: taskStats[0]?.total_tasks || 0,
          completed_tasks: taskStats[0]?.completed_tasks || 0,
          average_score: scoreStats[0]?.average_score || 0,
          best_score: scoreStats[0]?.best_score || 0,
        },
      })
    } catch (error) {
      console.error('获取仪表盘统计数据错误:', error)
      return res.status(500).json({ success: false, error: '获取仪表盘统计数据失败' })
    }
  }
}
