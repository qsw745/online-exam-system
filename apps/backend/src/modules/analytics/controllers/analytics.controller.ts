import type { Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import { AnalyticsService } from '../services/analytics.service.js'

const service = new AnalyticsService()

export class AnalyticsController {
  static async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const data = await service.getAnalyticsData({
        start_date: (req.query.start_date as string) || undefined,
        end_date: (req.query.end_date as string) || undefined,
        subject: (req.query.subject as string) || undefined,
      })
      return res.json({ success: true, message: '获取分析数据成功', data })
    } catch (error) {
      console.error('获取分析数据失败:', error)
      return res.status(500).json({ success: false, message: '获取分析数据失败', data: null })
    }
  }

  static async getSubjects(_req: AuthRequest, res: Response) {
    try {
      const subjects = await service.getSubjects()
      return res.json({ success: true, message: '获取科目列表成功', data: subjects })
    } catch (error) {
      console.error('获取科目列表失败:', error)
      return res.status(500).json({ success: false, message: '获取科目列表失败', data: [] })
    }
  }

  // 下面这些保留你的其它接口
  static async getOverview(req: AuthRequest, res: Response) {
    try {
      const period = (req.query.period as string) || '7d'
      const overview = await service.getOverview(period)
      return res.json({ success: true, data: overview })
    } catch (error) {
      console.error('获取概览数据错误:', error)
      return res.status(500).json({ success: false, error: '获取概览数据失败' })
    }
  }

  static async getKnowledgePoints(_req: AuthRequest, res: Response) {
    try {
      const data = await service.getKnowledgePoints()
      return res.json({ success: true, data })
    } catch (error) {
      console.error('获取知识点数据错误:', error)
      return res.status(500).json({ success: false, error: '获取知识点数据失败' })
    }
  }

  static async getDifficultyDistribution(_req: AuthRequest, res: Response) {
    try {
      const data = await service.getDifficultyDistribution()
      return res.json({ success: true, data })
    } catch (error) {
      console.error('获取难度分布数据错误:', error)
      return res.status(500).json({ success: false, error: '获取难度分布数据失败' })
    }
  }

  static async getUserActivity(req: AuthRequest, res: Response) {
    try {
      const period = (req.query.period as string) || '7d'
      const data = await service.getUserActivity(period)
      return res.json({ success: true, data })
    } catch (error) {
      console.error('获取用户活跃度数据错误:', error)
      return res.status(500).json({ success: false, error: '获取用户活跃度数据失败' })
    }
  }
}
