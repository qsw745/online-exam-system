// apps/backend/src/modules/leaderboard/routes/leaderboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { LeaderboardController } from '../controllers/leaderboard.controller'
import { validateRequest } from '@/common/middleware/validation'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from 'types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)

router.use(authenticateToken)

// 列表
router.get(
  '/',
  [
    query('category').optional().isIn(['all', 'global', 'subject', 'exam', 'monthly', 'weekly', 'daily']),
    query('type').optional().isIn(['all', 'score', 'time', 'accuracy', 'progress', 'custom']),
    query('active').optional().isBoolean(),
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
