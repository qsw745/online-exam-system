// apps/backend/src/modules/analytics/analytics.routes.ts
import { Router, type RequestHandler, type Response } from 'express'

// ✅ 控制器就在同目录
import { AnalyticsController } from './analytics.controller.js'

// ✅ 你的项目里 auth 中间件在 src/common/middleware/auth.ts
//    并通过 tsconfig 路径别名 @common/* 暴露
import { auth, requireRole } from '@common/middleware/auth.js'

// ✅ 类型定义在 src/types/auth.ts
import type { AuthRequest } from 'types/auth.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 的控制器包装为 Express 标准的 RequestHandler，
 * 统一把 req 转为 AuthRequest，并捕获异步错误。
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 综述数据
router.get('/', auth, wrap(AnalyticsController.getAnalytics))

// 科目列表
router.get('/subjects', auth, wrap(AnalyticsController.getSubjects))

// 概览（需要管理员/教师）
router.get('/overview', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getOverview))

// 知识点掌握（需要管理员/教师）
router.get('/knowledge-points', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getKnowledgePoints))

// 难度分布（需要管理员/教师）
router.get(
  '/difficulty-distribution',
  auth,
  requireRole(['admin', 'teacher']),
  wrap(AnalyticsController.getDifficultyDistribution)
)

// 用户活跃度（需要管理员/教师）
router.get('/user-activity', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getUserActivity))

// 成绩统计（需要管理员/教师）
router.get('/grade-stats', auth, requireRole(['admin', 'teacher']), wrap(AnalyticsController.getGradeStats))

export { router as analyticsRoutes }
