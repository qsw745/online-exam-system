// apps/backend/src/routes/dashboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { DashboardController } from '../controllers/dashboard.controller.js'
import type { AuthRequest } from '../types/auth.js'
import { auth } from '../middleware/auth.middleware.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 控制器包装成 Express 的 RequestHandler，
 * 以解决类型不匹配与统一处理异步错误。
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取仪表盘统计数据
router.get('/stats', auth, wrap(DashboardController.getStats))

export { router as dashboardRoutes }
