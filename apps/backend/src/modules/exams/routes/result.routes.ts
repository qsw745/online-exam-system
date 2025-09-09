// apps/backend/src/modules/exams/routes/result.routes.ts
import { Router, type RequestHandler, type NextFunction, type Response } from 'express'
import { ResultController } from '../controllers/result.controller'
import { authenticateToken } from '@common/middleware/auth'
import type { AuthRequest } from 'types/auth'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(ResultController.list))
router.get('/:id', wrap(ResultController.getById))

export { router as resultRoutes }
export default router
