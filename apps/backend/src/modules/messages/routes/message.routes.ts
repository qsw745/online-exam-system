// apps/backend/src/modules/messages/routes/message.routes.ts
import { Router, type RequestHandler, type Response, type NextFunction } from 'express'
import { MessageController } from '../controllers/message.controller.js'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRole } from '@/common/middleware/role-auth'

const router = Router()

const wrap =
  (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

router.use(authenticateToken)

// 用户侧
router.get('/', wrap(MessageController.list))
router.get('/unread-count', wrap(MessageController.unreadCount))
router.put('/:id/read', wrap(MessageController.markAsRead))
router.put('/read-all', wrap(MessageController.markAllAsRead))
router.delete('/:id', wrap(MessageController.delete))

// 管理侧（admin/teacher）
router.post('/', requireRole(['admin', 'teacher']), wrap(MessageController.create))
router.post('/batch', requireRole(['admin', 'teacher']), wrap(MessageController.createBatch))

// 仅 admin
router.get('/admin/list', requireRole(['admin']), wrap(MessageController.adminList))
router.delete('/admin/:id', requireRole(['admin']), wrap(MessageController.adminDelete))

export { router as messageRoutes }
export default router
