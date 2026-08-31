import { Router, type RequestHandler, type Response } from 'express'
import { authenticateToken } from '@/common/middleware/auth.js'
import { requireRole } from '@/common/middleware/auth.js'
import type { AuthRequest } from '@/types/auth.js'
import { ProctoringController } from '../controllers/proctoring.controller.js'
import { ProctoringReviewController } from '../controllers/proctoring-review.controller.js'

const router = Router()
const requireRoleStr = requireRole as unknown as (roles: string[]) => RequestHandler

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)
router.get('/review-cases', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.listStaffCases))
router.get('/review-cases/:caseId', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.getStaffCase))
router.post('/review-cases/:caseId/decisions', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.decideCase))
router.get('/review-cases/:caseId/export.csv', requireRoleStr(['admin', 'teacher']), wrap(ProctoringReviewController.exportCaseCsv))
router.get('/my-review-cases', wrap(ProctoringReviewController.listMyCases))
router.get('/my-review-cases/:caseId', wrap(ProctoringReviewController.getMyCase))
router.post('/my-review-cases/:caseId/responses', wrap(ProctoringReviewController.respond))
router.post('/my-review-cases/:caseId/appeals', wrap(ProctoringReviewController.appeal))
router.post('/events', wrap(ProctoringController.legacyReportEvent))
router.post('/consents', wrap(ProctoringController.createConsent))
router.post('/sessions', wrap(ProctoringController.createSession))
router.get('/sessions/:sessionId', wrap(ProctoringController.getSession))
router.post('/sessions/:sessionId/events', wrap(ProctoringController.recordFactualEvent))
router.post('/sessions/:sessionId/heartbeat', wrap(ProctoringController.heartbeat))
router.post('/sessions/:sessionId/identity-check', wrap(ProctoringController.verifyIdentity))
router.post('/sessions/:sessionId/complete', wrap(ProctoringController.complete))
router.get('/exams/:examId', wrap(ProctoringController.listExamEvents))

export { router as proctoringRoutes }
export default router
