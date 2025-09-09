import type { Response } from 'express'
import type { ApiResponse } from 'types/response.js'
import type { AuthRequest } from 'types/auth.js'
import type { Leaderboard, LeaderboardRecord, Competition } from '../domain/leaderboard.types.js'
import { LeaderboardService } from '../services/leaderboard.service.js'

const service = new LeaderboardService()

export class LeaderboardController {
  static async getLeaderboards(req: AuthRequest, res: Response<ApiResponse<{ leaderboards: Leaderboard[] }>>) {
    try {
      const leaderboards = await service.listLeaderboards({
        category: req.query.category as string | undefined,
        type: req.query.type as string | undefined,
        active: req.query.active as string | undefined,
      })
      res.json({ success: true, data: { leaderboards } })
    } catch (e) {
      res.status(500).json({ success: false, error: '获取排行榜列表失败' })
    }
  }

  static async getLeaderboardData(
    req: AuthRequest,
    res: Response<ApiResponse<{ leaderboard: Leaderboard; records: LeaderboardRecord[] }>>
  ) {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: '无效的排行榜ID' })
      const page = Number(req.query.page || 1)
      const limit = Number(req.query.limit || 50)
      const { leaderboard, records } = await service.getLeaderboardWithRecords(id, page, limit)
      if (!leaderboard) return res.status(404).json({ success: false, error: '排行榜不存在' })
      res.json({ success: true, data: { leaderboard, records } })
    } catch {
      res.status(500).json({ success: false, error: '获取排行榜数据失败' })
    }
  }

  static async getUserRank(
    req: AuthRequest,
    res: Response<ApiResponse<{ rank: LeaderboardRecord | null; total: number }>>
  ) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: '无效的排行榜ID' })
      const data = await service.getUserRankAndTotal(id, userId)
      res.json({ success: true, data })
    } catch {
      res.status(500).json({ success: false, error: '获取用户排名失败' })
    }
  }

  static async updateLeaderboardData(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      if (!req.user?.id || req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, error: '权限不足' })
      }
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: '无效的排行榜ID' })
      await service.recalcLeaderboard(id)
      res.json({ success: true, data: null })
    } catch (e) {
      if ((e as Error).message === 'NOT_FOUND') {
        return res.status(404).json({ success: false, error: '排行榜不存在' })
      }
      res.status(500).json({ success: false, error: '更新排行榜数据失败' })
    }
  }

  static async getCompetitions(req: AuthRequest, res: Response<ApiResponse<{ competitions: Competition[] }>>) {
    try {
      const competitions = await service.listCompetitions({
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
      })
      res.json({ success: true, data: { competitions } })
    } catch {
      res.status(500).json({ success: false, error: '获取竞赛列表失败' })
    }
  }

  static async joinCompetition(req: AuthRequest, res: Response<ApiResponse<null>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: '无效的竞赛ID' })
      await service.joinCompetition(userId, id, (req.body?.team_name as string | undefined) ?? null)
      res.json({ success: true, data: null })
    } catch (e) {
      const msg = (e as Error).message
      if (msg === 'NOT_OPEN') return res.status(404).json({ success: false, error: '竞赛不存在或不在报名期间' })
      if (msg === 'DUP') return res.status(400).json({ success: false, error: '您已经参加了这个竞赛' })
      if (msg === 'FULL') return res.status(400).json({ success: false, error: '竞赛参与人数已满' })
      res.status(500).json({ success: false, error: '参加竞赛失败' })
    }
  }

  static async getUserAchievements(req: AuthRequest, res: Response<ApiResponse<{ achievements: any[] }>>) {
    try {
      const userId = req.user?.id
      if (!userId) return res.status(401).json({ success: false, error: '未授权访问' })
      const achievements = await service.listUserAchievements(userId)
      res.json({ success: true, data: { achievements } })
    } catch {
      res.status(500).json({ success: false, error: '获取用户成就失败' })
    }
  }
}
