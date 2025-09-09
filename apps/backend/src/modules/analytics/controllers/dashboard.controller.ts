import type { Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import type { ApiResponse } from 'types/response.js'
import type { DashboardStatsData } from '../domain/dashboard.model'
import { DashboardService } from '../services/dashboard.service'

const service = new DashboardService()

export class DashboardController {
  static async getStats(req: AuthRequest, res: Response<ApiResponse<DashboardStatsData>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权' })
      const data = await service.getStats(userId)
      return res.json({ success: true, data })
    } catch (error) {
      console.error('获取仪表盘统计数据错误:', error)
      return res.status(500).json({ success: false, error: '获取仪表盘统计数据失败' })
    }
  }
}
