import { Router, type RequestHandler, type Response } from 'express'
import { ExamController } from '../controllers/exam.controller.js'
import { authenticateToken, requireRole } from '@/common/middleware/auth.js'
import type { AuthRequest } from '@/types/auth.js'

const router = Router()
const requireRoleStr = requireRole as unknown as (roles: string[]) => RequestHandler
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.get('/', authenticateToken, wrap(ExamController.list))
router.get('/:id', authenticateToken, wrap(ExamController.getById))
router.post('/', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.create))
router.put('/:id', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.update))
router.delete('/:id', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.delete))
router.post('/:id/review', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.submitReview))
router.post('/:id/start', authenticateToken, wrap(ExamController.start))
router.post('/:id/submit', authenticateToken, wrap(ExamController.submit))

export { router as examRoutes }
