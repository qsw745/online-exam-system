// apps/backend/src/routes/leaderboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'
import { LeaderboardController } from '../controllers/leaderboard.controller.js'
import { validateRequest } from '../middleware/validation.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/** 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 应用认证中间件
router.use(authenticateToken)

// 获取排行榜列表
router.get(
  '/',
  [
    query('category')
      .optional()
      .isIn(['all', 'global', 'subject', 'exam', 'monthly', 'weekly', 'daily'])
      .withMessage('排行榜分类无效'),
    query('type')
      .optional()
      .isIn(['all', 'score', 'time', 'accuracy', 'progress', 'custom'])
      .withMessage('排行榜类型无效'),
    query('active').optional().isBoolean().withMessage('活跃状态必须是布尔值'),
  ],
  validateRequest,
  wrap(LeaderboardController.getLeaderboards)
)

// 获取排行榜详情和排名数据
router.get(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('排行榜ID必须是正整数'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  ],
  validateRequest,
  wrap(LeaderboardController.getLeaderboardData)
)

// 获取用户在排行榜中的排名
router.get(
  '/:id/my-rank',
  [param('id').isInt({ min: 1 }).withMessage('排行榜ID必须是正整数')],
  validateRequest,
  wrap(LeaderboardController.getUserRank)
)

// 更新排行榜数据（管理员功能）
router.post(
  '/:id/update',
  [param('id').isInt({ min: 1 }).withMessage('排行榜ID必须是正整数')],
  validateRequest,
  wrap(LeaderboardController.updateLeaderboardData)
)

// 获取竞赛列表
router.get(
  '/competitions/list',
  [
    query('status')
      .optional()
      .isIn(['all', 'draft', 'registration', 'ongoing', 'finished', 'cancelled'])
      .withMessage('竞赛状态无效'),
    query('type').optional().isIn(['all', 'individual', 'team']).withMessage('竞赛类型无效'),
  ],
  validateRequest,
  wrap(LeaderboardController.getCompetitions)
)

// 参加竞赛
router.post(
  '/competitions/:id/join',
  [
    param('id').isInt({ min: 1 }).withMessage('竞赛ID必须是正整数'),
    body('team_name').optional().isString().isLength({ max: 100 }).withMessage('团队名称不能超过100个字符'),
  ],
  validateRequest,
  wrap(LeaderboardController.joinCompetition)
)

// 获取用户成就
router.get('/achievements/my', wrap(LeaderboardController.getUserAchievements))

export default router
