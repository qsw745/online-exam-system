import { Router, type RequestHandler, type Response } from 'express'

// ✅ 用“具名导入类”的方式，匹配 controller 的导出：export class DashboardController { ... }
import { DashboardController } from './dashboard.controller.js'

// 中间件与类型（ESM 需显式 .js 扩展名）
import { authenticateToken } from '../../common/middleware/auth.js'
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

// 统一包裹控制器，兼容 AuthRequest 类型并捕获异步异常
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 聚合器会把当前 router 挂载到 /api/dashboard
router.use(authenticateToken)
router.get('/stats', wrap(DashboardController.getStats))
// 如需扩展：
// router.get('/cards', wrap(DashboardController.getCards))
// router.get('/trends', wrap(DashboardController.getTrends))

export { router as dashboardRoutes }
