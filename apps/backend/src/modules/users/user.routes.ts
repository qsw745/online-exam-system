// apps/backend/src/modules/users/user.routes.ts
import { Router, type RequestHandler } from 'express'
import { authenticateToken, requireRole } from '../../common/middleware/auth.js'
import { UserController } from './user.controller.js'

// 上传中间件在 src/common/middleware/upload.ts
import { avatarUpload } from '../../common/middleware/upload.js'

/** 将控制器包装为标准 RequestHandler，避免 TS2769 的重载不匹配 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

const router = Router()

// 全局鉴权（会在 req.user / req.auth 注入 userId、orgId、isAdminInOrg）
router.use(authenticateToken)

// --- 当前用户 ---
router.get('/me', wrap(UserController.getCurrentUser))
router.put('/me', wrap(UserController.updateCurrentUser))
router.post('/me/avatar', avatarUpload, wrap(UserController.uploadAvatar))

// --- 用户设置 ---
router.get('/settings', wrap(UserController.getSettings))
router.post('/settings', wrap(UserController.saveSettings))

// --- 用户管理（需权限） ---
// - 若在当前 org 下是 admin => 直通；否则检查 users.role 是否在允许列表里（'admin' | 'teacher'）
router.get('/', requireRole(['admin', 'teacher'] as unknown as any[]), wrap(UserController.list))
router.get('/:id', requireRole(['admin', 'teacher'] as unknown as any[]), wrap(UserController.getById))

router.put('/:id', requireRole(['admin'] as unknown as any[]), wrap(UserController.update))
router.put('/:id/status', requireRole(['admin'] as unknown as any[]), wrap(UserController.updateStatus))
router.put('/:id/reset-password', requireRole(['admin'] as unknown as any[]), wrap(UserController.resetPassword))
router.delete('/:id', requireRole(['admin'] as unknown as any[]), wrap(UserController.delete))

export { router as userRoutes }
