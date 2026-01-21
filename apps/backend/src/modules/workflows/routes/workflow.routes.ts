import { Router, type RequestHandler, type Response } from 'express'
import { authenticateToken, requireRole } from '@/common/middleware/auth.js'
import type { AuthRequest } from '@/types/auth.js'
import { WorkflowController } from '../controllers/workflow.controller.js'

const router = Router()
const requireRoleStr = requireRole as unknown as (roles: string[]) => RequestHandler

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/templates', wrap(WorkflowController.listTemplates))
router.get('/templates/:id', wrap(WorkflowController.getTemplate))
router.get('/instances/:id', wrap(WorkflowController.getInstanceDetail))
router.post('/templates', requireRoleStr(['admin', 'teacher']), wrap(WorkflowController.createTemplate))
router.put('/templates/:id', requireRoleStr(['admin', 'teacher']), wrap(WorkflowController.updateTemplate))
router.post('/templates/:id/publish', requireRoleStr(['admin', 'teacher']), wrap(WorkflowController.publishTemplate))

router.post('/instances', wrap(WorkflowController.startInstance))
router.get('/tasks/mine', wrap(WorkflowController.listMyTasks))
router.post('/tasks/:id/approve', wrap(WorkflowController.approveTask))
router.post('/tasks/:id/reject', wrap(WorkflowController.rejectTask))

router.post('/exams/:id/review', requireRoleStr(['admin', 'teacher']), wrap(WorkflowController.submitExamReview))

export { router as workflowRoutes }
export default router
