import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = Router();

// 获取通知列表
router.get('/', auth, NotificationController.list);

// 获取未读通知数量
router.get('/unread-count', auth, NotificationController.unreadCount);

// 标记通知为已读
router.put('/:id/read', auth, NotificationController.markAsRead);

// 创建通知（管理员/教师）
router.post('/', auth, NotificationController.create);

// 批量创建通知（管理员/教师）
router.post('/batch', auth, NotificationController.createBatch);

// 批量标记所有通知为已读
router.put('/read-all', auth, NotificationController.markAllAsRead);

// 删除通知
router.delete('/:id', auth, NotificationController.delete);

export { router as notificationRoutes };