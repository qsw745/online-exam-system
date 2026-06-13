import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'
import { CacheController } from '../controllers/cache.controller'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: any) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/stats', wrap(CacheController.stats))
router.post('/flush', wrap(CacheController.flush))

export { router as cacheRoutes }
export default router
