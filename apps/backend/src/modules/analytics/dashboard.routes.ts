// apps/backend/src/modules/analytics/dashboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'

// ✅ 控制器就在同目录
import { DashboardController } from './dashboard.controller.js'

// ✅ 中间件与类型用别名（对应 src/common/middleware 与 src/types）
import { auth } from '@common/middleware/auth.js'
import type { AuthRequest } from 'types/auth.js'

const router = Router()

/** 统一包裹控制器，兼容类型并捕获异步异常 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取仪表盘统计数据
router.get('/stats', auth, wrap(DashboardController.getStats))

export { router as dashboardRoutes }
