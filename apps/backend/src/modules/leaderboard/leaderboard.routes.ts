// apps/backend/src/modules/leaderboard/leaderboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { body, param, query } from 'express-validator'

// 同目录下的控制器（无 .js 后缀）
import { LeaderboardController } from './leaderboard.controller.js'

// 公共中间件：校验与鉴权（从 modules/ 返回到 common/middleware）
import { validateRequest } from '../../common/middleware/validation.js'
import { authenticateToken } from '../../common/middleware/auth.js'

// 类型声明（从 modules/ 返回到 types）
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

/**
 * 统一包装控制器，兼容异步错误并保留类型
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 全局应用鉴权（如某些公开接口需要放行，可在对应路由前单独放行）
router.use(authenticateToken)

/**
 * 获取排行榜列表
 * GET /api/leaderboard?category=&type=&active=
 */
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

/**
 * 获取排行榜详情与排名数据
 * GET /api/leaderboard/:id?page=&limit=
 */
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

/**
 * 获取当前用户在排行榜中的排名
 * GET /api/leaderboard/:id/my-rank
 */
router.get(
  '/:id/my-rank',
  [param('id').isInt({ min: 1 }).withMessage('排行榜ID必须是正整数')],
  validateRequest,
  wrap(LeaderboardController.getUserRank)
)

/**
 * 管理员：触发排行榜数据更新
 * POST /api/leaderboard/:id/update
 */
router.post(
  '/:id/update',
  [param('id').isInt({ min: 1 }).withMessage('排行榜ID必须是正整数')],
  validateRequest,
  wrap(LeaderboardController.updateLeaderboardData)
)

/**
 * 竞赛列表
 * GET /api/leaderboard/competitions/list?status=&type=
 */
router.get(
  '/competitions/list',
  [
    query('status')
      .optional()
      .isIn(['all', 'draft', 'registration', 'ongoing', 'finished,', 'cancelled'.replace(',', '')]) // 防止拷贝时逗号误入字符串
      .withMessage('竞赛状态无效'),
    query('type').optional().isIn(['all', 'individual', 'team']).withMessage('竞赛类型无效'),
  ],
  validateRequest,
  wrap(LeaderboardController.getCompetitions)
)

/**
 * 参加竞赛
 * POST /api/leaderboard/competitions/:id/join
 */
router.post(
  '/competitions/:id/join',
  [
    param('id').isInt({ min: 1 }).withMessage('竞赛ID必须是正整数'),
    body('team_name').optional().isString().isLength({ max: 100 }).withMessage('团队名称不能超过100个字符'),
  ],
  validateRequest,
  wrap(LeaderboardController.joinCompetition)
)

/**
 * 获取当前用户成就
 * GET /api/leaderboard/achievements/my
 */
router.get('/achievements/my', wrap(LeaderboardController.getUserAchievements))

export default router
