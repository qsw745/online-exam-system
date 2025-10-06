// apps/backend/src/modules/analytics/routes/dashboard.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { DashboardController } from '../controllers/dashboard.controller'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)
router.get('/stats', wrap(DashboardController.getStats))

export default router
