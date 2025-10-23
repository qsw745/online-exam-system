import { Router, type RequestHandler } from 'express'
import { authenticateToken, requireRole } from '@/common/middleware/auth.js'
import { UserController } from '@/modules/users/controllers/user.controller.js'
import { upload } from '@/common/middleware/upload.js'

type AsyncCtrl = (req: any, res: any) => any | Promise<any>
const wrap =
  (fn: AsyncCtrl): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next)

const router = Router()

// 所有 /users 接口都需要登录
router.use(authenticateToken)

// 当前用户
router.get('/me', wrap(UserController.getCurrentUser))
router.put('/me', wrap(UserController.updateCurrentUser))
router.put('/me/password', wrap(UserController.changePassword))
router.post('/me/avatar', upload.single('avatar'), wrap(UserController.uploadAvatar))

// 个性化设置
router.get('/settings', wrap(UserController.getSettings))
router.post('/settings', wrap(UserController.saveSettings))

// —— 批量删除必须放在参数路由前面（防止被误匹配） —— //
router.post('/batch-delete', requireRole(['admin']), wrap(UserController.batchDelete))

// 管理/教师可见
router.get('/', requireRole(['admin', 'teacher']), wrap(UserController.list))
router.get('/:id', requireRole(['admin', 'teacher']), wrap(UserController.getById))

// 仅管理员
router.post('/', requireRole(['admin']), wrap(UserController.create))
router.put('/:id', requireRole(['admin']), wrap(UserController.update))
router.put('/:id/status', requireRole(['admin']), wrap(UserController.updateStatus))
router.put('/:id/reset-password', requireRole(['admin']), wrap(UserController.resetPassword))
router.delete('/:id', requireRole(['admin']), wrap(UserController.delete))

export { router as userRoutes }
export default router
