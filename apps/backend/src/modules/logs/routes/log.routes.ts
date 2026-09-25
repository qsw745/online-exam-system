import { authenticateToken, requireRole } from '@/common/middleware/auth'
import { Router, type RequestHandler, type Response } from 'express'
import type { AuthRequest } from '@/types/auth'
import { LogController } from '../controllers/log.controller'

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

// ✅ 放行 audit，细粒度鉴权在 Controller 里做
router.get('/audit', wrap(LogController.getAuditLogs))

router.get('/login', wrap(LogController.getLoginLogs))
router.get('/exam/:examId', wrap(LogController.getExamLogs))
router.post('/cleanup', requireRole(['admin']), wrap(LogController.cleanupLogs))

// ✅ 在线用户/强退
router.get('/online', wrap(LogController.getOnlineUsers))
router.post('/online/kick', requireRole(['admin']), wrap(LogController.kickOnlineUser))
router.delete('/online/:id', requireRole(['admin']), wrap(LogController.kickOnlineUser))

export default router
