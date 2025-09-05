import { Router, type RequestHandler, type Response } from 'express'
import { AnalyticsController } from './analytics.controller.js'
import { authenticateToken, requireRole } from '../../common/middleware/auth.js' // ✅ 改这里
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 综述数据
router.get('/', authenticateToken, wrap(AnalyticsController.getAnalytics)) // ✅ 改这里
// 科目列表
router.get('/subjects', authenticateToken, wrap(AnalyticsController.getSubjects)) // ✅ 改这里
// 管理可见接口
router.get('/overview', authenticateToken, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getOverview))
router.get(
  '/knowledge-points',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  wrap(AnalyticsController.getKnowledgePoints)
)
router.get(
  '/difficulty-distribution',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  wrap(AnalyticsController.getDifficultyDistribution)
)
router.get(
  '/user-activity',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  wrap(AnalyticsController.getUserActivity)
)
router.get(
  '/grade-stats',
  authenticateToken,
  requireRole(['admin', 'teacher']),
  wrap(AnalyticsController.getGradeStats)
)

export { router as analyticsRoutes }
