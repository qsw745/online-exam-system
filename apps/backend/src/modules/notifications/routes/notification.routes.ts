// apps/backend/src/modules/notifications/routes/notification.routes.ts
import { Router, type RequestHandler, type Response, type NextFunction } from 'express'
import { NotificationController } from '../controllers/notification.controller'
import { authenticateToken } from '@common/middleware/auth'
import { requireRole } from '@common/middleware/role-auth'

const router = Router()

// 轻量包装：捕获 async 错误交给 next
const wrap =
  (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

router.use(authenticateToken)

// 用户侧
router.get('/', wrap(NotificationController.list))
router.get('/unread-count', wrap(NotificationController.unreadCount))
router.put('/:id/read', wrap(NotificationController.markAsRead))
router.put('/read-all', wrap(NotificationController.markAllAsRead))
router.delete('/:id', wrap(NotificationController.delete))

// 管理侧（角色：admin/teacher）
router.post('/', requireRole(['admin', 'teacher']), wrap(NotificationController.create))
router.post('/batch', requireRole(['admin', 'teacher']), wrap(NotificationController.createBatch))

// 仅 admin
router.get('/admin/list', requireRole(['admin']), wrap(NotificationController.adminList))
router.delete('/admin/:id', requireRole(['admin']), wrap(NotificationController.adminDelete))

export { router as notificationRoutes }
export default router
