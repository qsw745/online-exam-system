// apps/backend/src/modules/users/routes/user.routes.ts
import { Router, type RequestHandler } from 'express'
import { authenticateToken, requireRole } from '@/common/middleware/auth'
import { UserController } from '@/modules/users/controllers/user.controller'
import { avatarUpload } from '@/common/middleware/upload'

// 小工具：把 async 控制器包装成标准 Express 处理器
type AsyncCtrl = (req: any, res: any) => any | Promise<any>
const wrap =
  (fn: AsyncCtrl): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next)

const router = Router()

// 全部接口需要已登录
router.use(authenticateToken)

// me
router.get('/me', wrap(UserController.getCurrentUser))
router.put('/me', wrap(UserController.updateCurrentUser))
router.post('/me/avatar', avatarUpload, wrap(UserController.uploadAvatar))

// settings
router.get('/settings', wrap(UserController.getSettings))
router.post('/settings', wrap(UserController.saveSettings))

// admin / teacher
router.get('/', requireRole(['admin', 'teacher']), wrap(UserController.list))
router.get('/:id', requireRole(['admin', 'teacher']), wrap(UserController.getById))

// admin only
router.put('/:id', requireRole(['admin']), wrap(UserController.update))
router.put('/:id/status', requireRole(['admin']), wrap(UserController.updateStatus))
router.put('/:id/reset-password', requireRole(['admin']), wrap(UserController.resetPassword))
router.delete('/:id', requireRole(['admin']), wrap(UserController.delete))

export { router as userRoutes }
