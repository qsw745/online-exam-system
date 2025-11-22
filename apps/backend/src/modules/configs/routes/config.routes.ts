import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'
import { ConfigController } from '../controllers/config.controller'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: any) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(ConfigController.list))
router.post('/', wrap(ConfigController.create))
router.put('/:id', wrap(ConfigController.update))
router.delete('/:id', wrap(ConfigController.remove))

export { router as configRoutes }
export default router
