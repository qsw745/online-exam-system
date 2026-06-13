import type { AuthRequest } from '@/types/auth.js'
import type { Res } from '@/types/response.js'
import type { Leaderboard, LeaderboardRecord, Competition } from '../domain/leaderboard.model.js'
import { LeaderboardService } from '../services/leaderboard.service.js'

const service = new LeaderboardService()

export class LeaderboardController {
  static async getLeaderboards(req: AuthRequest, res: Res) {
    try {
      const leaderboards = await service.listLeaderboards({
        category: req.query.category as string | undefined,
        type: req.query.type as string | undefined,
        active: req.query.active as string | undefined,
      })
      return res.ok<{ leaderboards: Leaderboard[] }>({ leaderboards })
    } catch {
      return res.internal('获取排行榜列表失败')
    }
  }

  static async getLeaderboardData(req: AuthRequest, res: Res) {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.internal('无效的排行榜ID')
      const page = Number(req.query.page || 1)
      const limit = Number(req.query.limit || 50)
      const { leaderboard, records } = await service.getLeaderboardWithRecords(id, page, limit)
      if (!leaderboard) return res.internal('排行榜不存在')
      return res.ok<{ leaderboard: Leaderboard; records: LeaderboardRecord[] }>({ leaderboard, records })
    } catch {
      return res.internal('获取排行榜数据失败')
    }
  }

  static async getUserRank(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.internal('无效的排行榜ID')
      const data = await service.getUserRankAndTotal(id, userId)
      return res.ok<{ rank: LeaderboardRecord | null; total: number }>(data)
    } catch {
      return res.internal('获取用户排名失败')
    }
  }

  static async updateLeaderboardData(req: AuthRequest, res: Res) {
    try {
      if (!req.user?.id || (req as any).user?.role !== 'admin') {
        return res.unauthorized('权限不足')
      }
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.internal('无效的排行榜ID')
      await service.recalcLeaderboard(id)
      return res.ok<null>(null)
    } catch (e) {
      const msg = (e as Error)?.message
      if (msg === 'NOT_FOUND') return res.internal('排行榜不存在')
      return res.internal('更新排行榜数据失败')
    }
  }

  static async getCompetitions(req: AuthRequest, res: Res) {
    try {
      const competitions = await service.listCompetitions({
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
      })
      return res.ok<{ competitions: Competition[] }>({ competitions })
    } catch {
      return res.internal('获取竞赛列表失败')
    }
  }

  static async joinCompetition(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) return res.internal('无效的竞赛ID')
      await service.joinCompetition(userId, id, (req.body?.team_name as string | undefined) ?? null)
      return res.ok<null>(null)
    } catch (e) {
      const msg = (e as Error).message
      if (msg === 'NOT_OPEN') return res.internal('竞赛不存在或不在报名期间')
      if (msg === 'DUP') return res.internal('您已经参加了这个竞赛')
      if (msg === 'FULL') return res.internal('竞赛参与人数已满')
      return res.internal('参加竞赛失败')
    }
  }

  static async getUserAchievements(req: AuthRequest, res: Res) {
    try {
      const userId = req.user?.id
      if (!userId) return res.unauthorized('未授权访问')
      const achievements = await service.listUserAchievements(userId)
      return res.ok<{ achievements: any[] }>({ achievements })
    } catch {
      return res.internal('获取用户成就失败')
    }
  }
}
