import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import type { ApiResponse } from '@/types/response.js'
import { CODES } from '@/types/response.js'
import type { DashboardStatsData } from '../domain/dashboard.model'
import { DashboardService } from '../services/dashboard.service'

const service = new DashboardService()

export class DashboardController {
  static async getStats(req: AuthRequest, res: Response<ApiResponse<DashboardStatsData>>) {
    try {
      const userId = req.user?.id
      if (!userId) return (res as any).unauthorized('未授权', { code: CODES.AUTH_UNAUTHORIZED })
      const data = await service.getStats(userId)
      // 注意：ok 是运行时方法，不能带类型参数（去掉 <DashboardStatsData>）
      return (res as any).ok(data, '获取仪表盘统计数据成功')
    } catch (error: any) {
      console.error('获取仪表盘统计数据错误:', error)
      return (res as any).internal(error?.message || '获取仪表盘统计数据失败', { code: CODES.INTERNAL_ERROR })
    }
  }
}

export default DashboardController
