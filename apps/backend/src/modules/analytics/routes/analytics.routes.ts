// apps/backend/src/modules/analytics/routes/analytics.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { AnalyticsController } from '../controllers/analytics.controller'
import { authenticateToken, requireRole } from '@/common/middleware/auth'
import type { AuthRequest } from 'types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.get('/', authenticateToken, wrap(AnalyticsController.getAnalytics))
router.get('/subjects', authenticateToken, wrap(AnalyticsController.getSubjects))
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

export default router
