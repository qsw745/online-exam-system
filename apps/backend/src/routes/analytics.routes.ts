import { Router } from 'express'
import { AnalyticsController } from '../controllers/analytics.controller.js'
import { auth, requireRole } from '../middleware/auth.middleware.js'

const router = Router()

// 获取综合分析数据（前端AnalyticsPage调用）
router.get('/', auth, AnalyticsController.getAnalytics)

// 获取科目列表
router.get('/subjects', auth, AnalyticsController.getSubjects)

// 获取概览数据
router.get('/overview', auth, requireRole(['admin', 'teacher']), AnalyticsController.getOverview)

// 获取知识点掌握情况
router.get('/knowledge-points', auth, requireRole(['admin', 'teacher']), AnalyticsController.getKnowledgePoints)

// 获取难度分布
router.get(
  '/difficulty-distribution',
  auth,
  requireRole(['admin', 'teacher']),
  AnalyticsController.getDifficultyDistribution
)

// 获取用户活跃度
router.get('/user-activity', auth, requireRole(['admin', 'teacher']), AnalyticsController.getUserActivity)

// 获取成绩统计数据
router.get('/grade-stats', auth, requireRole(['admin', 'teacher']), AnalyticsController.getGradeStats)

export { router as analyticsRoutes }
