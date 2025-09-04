// apps/backend/src/routes/analytics.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { AnalyticsController } from '../controllers/analytics.controller.js'
import type { AuthRequest } from '../types/auth.js'

// ✅ 请确认这条导入路径与项目中实际中间件文件一致（通常是 ../middleware/auth.js）
import { auth, requireRole } from '../middleware/auth.middleware.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 的控制器包装为 Express 标准的 RequestHandler
 * - 统一把 req 转成 AuthRequest
 * - 捕获异步异常并交给 next()
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取综合分析数据（前端AnalyticsPage调用）
router.get('/', auth, wrap(AnalyticsController.getAnalytics))

// 获取科目列表
router.get('/subjects', auth, wrap(AnalyticsController.getSubjects))

// 获取概览数据
router.get('/overview', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getOverview))

// 获取知识点掌握情况
router.get('/knowledge-points', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getKnowledgePoints))

// 获取难度分布
router.get(
  '/difficulty-distribution',
  auth,
  requireRole(['admin', 'teacher']),
  wrap(AnalyticsController.getDifficultyDistribution)
)

// 获取用户活跃度
router.get('/user-activity', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getUserActivity))

// 获取成绩统计数据
router.get('/grade-stats', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getGradeStats))

export { router as analyticsRoutes }
