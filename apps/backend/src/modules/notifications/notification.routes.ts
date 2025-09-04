// apps/backend/src/routes/notification.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { NotificationController } from '../controllers/notification.controller.js'
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/** 将控制器 (req: AuthRequest, res: Response) 包装成 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 统一认证
router.use(authenticateToken)

// 获取通知列表
router.get('/', wrap(NotificationController.list))

// 获取未读通知数量
router.get('/unread-count', wrap(NotificationController.unreadCount))

// 标记通知为已读
router.put('/:id/read', wrap(NotificationController.markAsRead))

// 创建通知（管理员/教师）
router.post('/', requireRole(['admin', 'teacher']), wrap(NotificationController.create))

// 批量创建通知（管理员/教师）
router.post('/batch', requireRole(['admin', 'teacher']), wrap(NotificationController.createBatch))

// 批量标记所有通知为已读
router.put('/read-all', wrap(NotificationController.markAllAsRead))

// 删除通知（自己的）
router.delete('/:id', wrap(NotificationController.delete))

// 管理员路由
// 获取所有通知（管理员）
router.get('/admin/list', requireRole(['admin']), wrap(NotificationController.adminList))

// 删除任意通知（管理员）
router.delete('/admin/:id', requireRole(['admin']), wrap(NotificationController.adminDelete))

export { router as notificationRoutes }
