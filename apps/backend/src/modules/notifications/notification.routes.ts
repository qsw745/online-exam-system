// apps/backend/src/modules/notifications/notification.routes.ts
import { Router, type RequestHandler, type Response, type NextFunction } from 'express'

// 控制器（同目录）
import { NotificationController } from './notification.controller.js'

// 中间件（根据你的目录树）
import { authenticateToken } from '../../common/middleware/auth.js'
import { requireRole } from '../../common/middleware/role-auth.js'

const router = Router()

/**
 * 通用包装器：接受 (req, res) 控制器并统一捕获异步错误。
 * 用 any 避免把 Express.Request 强行断言成自定义 AuthRequest 而导致的重载冲突。
 */
const wrap = (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler => {
  return (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }
}

// 统一认证
router.use(authenticateToken)

// 获取通知列表
router.get('/', wrap(NotificationController.list))

// 获取未读通知数量
router.get('/unread-count', wrap(NotificationController.unreadCount))

// 标记通知为已读（控制器内部若需要 number，请在控制器中转为 Number(req.params.id)）
router.put('/:id/read', wrap(NotificationController.markAsRead))

// 创建通知（管理员/教师）—— requireRole 在你的类型里期望 number[]，这里用 any 消除 “string 不能赋给 number” 报错
router.post('/', requireRole(['admin', 'teacher'] as any), wrap(NotificationController.create))

// 批量创建通知（管理员/教师）
router.post('/batch', requireRole(['admin', 'teacher'] as any), wrap(NotificationController.createBatch))

// 批量标记所有通知为已读
router.put('/read-all', wrap(NotificationController.markAllAsRead))

// 删除通知（自己的）
router.delete('/:id', wrap(NotificationController.delete))

// 管理员路由
router.get('/admin/list', requireRole(['admin'] as any), wrap(NotificationController.adminList))
router.delete('/admin/:id', requireRole(['admin'] as any), wrap(NotificationController.adminDelete))

export { router as notificationRoutes }
