// apps/backend/src/modules/leaderboard/routes/leaderboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { LeaderboardController } from '../controllers/leaderboard.controller'
import { validateRequest } from '@/common/middleware/validation'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)

// ---- 别名映射（把前端可能传的值转换为后端规范值） ----
const TYPE_ALIASES: Record<string, string> = {
  // 前端 tabs/旧调用里常见
  study_time: 'time',
  total_time: 'time',
  correctness: 'accuracy',
  overall: 'all',
  // 其它可能的历史别名
  totalScore: 'score',
  progress_score: 'progress',
}
const normalizeType = (v: unknown) => {
  if (typeof v !== 'string') return v
  const key = v.trim()
  return TYPE_ALIASES[key] || key
}
const normalizeCategory = (v: unknown) => {
  // 目前 category 已经支持 'all'，若以后有别名可在此补充
  return v
}
const normalizeBoolean = (v: unknown) => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(s)) return true
    if (['false', '0', 'no', 'n'].includes(s)) return false
  }
  return v
}

router.use(authenticateToken)

// 列表
router.get(
  '/',
  [
    query('category')
      .optional()
      .customSanitizer(normalizeCategory)
      .isIn(['all', 'global', 'subject', 'exam', 'monthly', 'weekly', 'daily']),
    query('type')
      .optional()
      .customSanitizer(normalizeType)
      .isIn(['all', 'score', 'time', 'accuracy', 'progress', 'custom']),
    query('active').optional().customSanitizer(normalizeBoolean).isBoolean(),
  ],
  validateRequest,
  wrap(LeaderboardController.getLeaderboards)
)

// 详情+记录
router.get(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  wrap(LeaderboardController.getLeaderboardData)
)

// 我的排名
router.get('/:id/my-rank', [param('id').isInt({ min: 1 })], validateRequest, wrap(LeaderboardController.getUserRank))

// 管理员触发更新
router.post(
  '/:id/update',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  wrap(LeaderboardController.updateLeaderboardData)
)

// 竞赛
router.get(
  '/competitions/list',
  [
    query('status').optional().isIn(['all', 'draft', 'registration', 'ongoing', 'finished', 'cancelled']),
    query('type').optional().isIn(['all', 'individual', 'team']),
  ],
  validateRequest,
  wrap(LeaderboardController.getCompetitions)
)

router.post(
  '/competitions/:id/join',
  [param('id').isInt({ min: 1 }), body('team_name').optional().isString().isLength({ max: 100 })],
  validateRequest,
  wrap(LeaderboardController.joinCompetition)
)

// 成就
router.get('/achievements/my', wrap(LeaderboardController.getUserAchievements))

export default router
