import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'
import { IntegrationController } from '../controllers/integration.controller'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: any) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(IntegrationController.list))
router.post('/', wrap(IntegrationController.create))
router.put('/:id', wrap(IntegrationController.update))
router.delete('/:id', wrap(IntegrationController.remove))

export { router as integrationRoutes }
export default router
