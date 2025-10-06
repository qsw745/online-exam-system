// apps/backend/src/modules/admin-settings/routes/admin-settings.routes.ts
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { body } from 'express-validator'
import { authenticateToken } from '@/common/middleware/auth.js'
import { validateRequest } from '@/common/middleware/validation.js'
import type { AuthRequest } from '@/types/auth.js'
import { AdminSettingsController } from '../controllers/admin-settings.controller.js'

const router = Router()
const ALLOWED_ROLES = new Set(['admin', 'teacher'])

function requireRole(_roles = ALLOWED_ROLES): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as AuthRequest).user?.role
    if (!role) return res.status(401).json({ success: false, error: '未授权访问' })
    if (!_roles.has(role)) return res.status(403).json({ success: false, error: '无权限' })
    next()
  }
}

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// ✅ 统一先要求“已登录”
router.use(authenticateToken)

// ✅ 登录即可读取系统设置
router.get('/settings', wrap(AdminSettingsController.getSettings))

// ✅ 仅 admin/teacher 可修改系统设置
router.put(
  '/settings',
  requireRole(),
  [
    body('systemName').optional().isString().isLength({ min: 1, max: 100 }),
    body('allowUserRegistration').optional().isBoolean(),
    body('maxLoginAttempts').optional().isInt({ min: 1, max: 20 }),
    body('defaultPassword').optional().isString().isLength({ min: 0, max: 100 }),

    // 新增校验
    body('enableCaptcha').optional().isBoolean(),
    body('captchaAfterFailed').optional().isInt({ min: 1, max: 20 }),

    body('enableStrongPassword').optional().isBoolean(),
    body('strongPasswordRules').optional().isObject(),
    body('strongPasswordRules.minLength').optional().isInt({ min: 6, max: 64 }),
    body('strongPasswordRules.requireUpper').optional().isBoolean(),
    body('strongPasswordRules.requireLower').optional().isBoolean(),
    body('strongPasswordRules.requireNumber').optional().isBoolean(),
    body('strongPasswordRules.requireSymbol').optional().isBoolean(),
    body('strongPasswordRules.forbidRepeated').optional().isBoolean(),
    body('strongPasswordRules.forbidCommon').optional().isBoolean(),
  ],
  validateRequest,
  wrap(AdminSettingsController.updateSettings)
)

export { router as adminSettingsRoutes }
export default router
