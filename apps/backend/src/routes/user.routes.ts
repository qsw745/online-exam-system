// apps/backend/src/routes/user.routes.ts
import { Router, type RequestHandler } from 'express'
import { UserController } from '../controllers/user.controller.js'
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js'
import { avatarUpload } from '../middleware/upload.middleware.js'

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
// 说明：使用 auth.middleware.ts 的 requireRole：
// - 若在当前 org 下是 admin => 直通；
// - 否则回退检查 users.role 是否在允许列表里（'admin' | 'teacher'）
router.get('/', requireRole(['admin', 'teacher']), wrap(UserController.list))
router.get('/:id', requireRole(['admin', 'teacher']), wrap(UserController.getById))

router.put('/:id', requireRole(['admin']), wrap(UserController.update))
router.put('/:id/status', requireRole(['admin']), wrap(UserController.updateStatus))
router.put('/:id/reset-password', requireRole(['admin']), wrap(UserController.resetPassword))
router.delete('/:id', requireRole(['admin']), wrap(UserController.delete))

export { router as userRoutes }
