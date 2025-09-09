// apps/backend/src/modules/analytics/routes/log.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { LogController } from '../controllers/log.controller'
import { authenticateToken, requireRole } from '@common/middleware/auth'
import type { AuthRequest } from 'types/auth'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.use(authenticateToken)

router.get('/', wrap(LogController.getLogs))
router.get('/export', wrap(LogController.exportLogs))
router.get('/user', wrap(LogController.getUserLogs))
router.get('/system', requireRole(['admin']), wrap(LogController.getSystemLogs))
router.get('/audit', requireRole(['admin']), wrap(LogController.getAuditLogs))
router.get('/login', wrap(LogController.getLoginLogs))
router.get('/exam/:examId', wrap(LogController.getExamLogs))
router.post('/cleanup', requireRole(['admin']), wrap(LogController.cleanupLogs))

export default router
