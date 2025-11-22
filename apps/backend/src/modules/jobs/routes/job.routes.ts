import { Router, type RequestHandler } from 'express'
import { authenticateToken } from '@/common/middleware/auth'
import type { AuthRequest } from '@/types/auth'
import { JobController } from '../controllers/job.controller'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: any) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(JobController.list))
router.post('/', wrap(JobController.create))
router.put('/:id', wrap(JobController.update))
router.delete('/:id', wrap(JobController.remove))

export { router as jobRoutes }
export default router
