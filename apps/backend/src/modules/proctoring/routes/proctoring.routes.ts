import { Router, type RequestHandler, type Response } from 'express'
import { authenticateToken } from '@/common/middleware/auth.js'
import type { AuthRequest } from '@/types/auth.js'
import { ProctoringController } from '../controllers/proctoring.controller.js'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)
router.post('/events', wrap(ProctoringController.reportEvent))
router.get('/exams/:examId', wrap(ProctoringController.listExamEvents))

export { router as proctoringRoutes }
export default router
