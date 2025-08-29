// apps/backend/src/routes/user.routes.ts
import { Router, type RequestHandler } from 'express'
import { UserController } from '../controllers/user.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/roleAuth.js'
import { avatarUpload } from '../middleware/upload.middleware.js'
import { ROLE_IDS } from '../constants/roles.js'

/** 将控制器包装为标准 RequestHandler，避免 TS2769 的重载不匹配 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

const router = Router()

// 全局鉴权
router.use(authenticateToken)

// --- 当前用户 ---
router.get('/me', wrap(UserController.getCurrentUser))
router.put('/me', wrap(UserController.updateCurrentUser))
router.post('/me/avatar', avatarUpload, wrap(UserController.uploadAvatar))

// --- 用户设置 ---
router.get('/settings', wrap(UserController.getSettings))
router.post('/settings', wrap(UserController.saveSettings))

// --- 用户管理（需权限） ---
router.get('/', requireRole([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(UserController.list))
router.get('/:id', requireRole([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(UserController.getById))

router.put('/:id', requireRole([ROLE_IDS.ADMIN]), wrap(UserController.update))
router.put('/:id/status', requireRole([ROLE_IDS.ADMIN]), wrap(UserController.updateStatus))
router.put('/:id/reset-password', requireRole([ROLE_IDS.ADMIN]), wrap(UserController.resetPassword))
router.delete('/:id', requireRole([ROLE_IDS.ADMIN]), wrap(UserController.delete))

export { router as userRoutes }
