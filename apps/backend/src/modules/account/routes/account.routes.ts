import { Router, type RequestHandler, type Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import { authenticateToken } from '@/common/middleware/auth'
import { rateLimit } from '@/common/middleware/rate-limit'
import { AccountDeletionController } from '../controllers/account-deletion.controller'

const router = Router()
const wrap = (
  handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown,
): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req as AuthRequest, res)).catch(next)
}

router.get('/deletion/preview', authenticateToken, wrap(AccountDeletionController.preview))
router.post(
  '/deletion/request',
  authenticateToken,
  rateLimit({ keyBuilder: req => `rl:user:${(req as any).user?.id}:account-deletion`, limit: 3, windowSec: 3600 }),
  wrap(AccountDeletionController.request),
)
router.post(
  '/deletion/status',
  rateLimit({ keyBuilder: req => `rl:ip:${(req as any).ip || req.ip}:account-deletion-status`, limit: 5, windowSec: 300 }),
  wrap(AccountDeletionController.status),
)
router.post(
  '/deletion/cancel',
  rateLimit({ keyBuilder: req => `rl:ip:${(req as any).ip || req.ip}:account-deletion-cancel`, limit: 5, windowSec: 300 }),
  wrap(AccountDeletionController.cancel),
)

export { router as accountRoutes }
export default router
