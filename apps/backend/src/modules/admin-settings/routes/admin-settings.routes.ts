// apps/backend/src/modules/admin-settings/routes/admin-settings.routes.ts
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { body } from 'express-validator'
import { authenticateToken } from '@/common/middleware/auth.js'
import { validateRequest } from '@/common/middleware/validation.js'
import type { AuthRequest } from '@/types/auth.js'
import { AdminSettingsController } from '../controllers/admin-settings.controller.js'

const router = Router()
const ALLOWED_ROLES = new Set(['admin', 'teacher'])
// 需与前端 apps/web/src/shared/utils/datetime.ts 的 DATETIME_FORMAT_GROUPS 保持一致
const DATETIME_FORMATS = [
  // 精确到秒
  'YYYY-MM-DD HH:mm:ss',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY.MM.DD HH:mm:ss',
  'YYYY年MM月DD日 HH:mm:ss',
  // 精确到分钟
  'YYYY-MM-DD HH:mm',
  'YYYY/MM/DD HH:mm',
  'YYYY.MM.DD HH:mm',
  'YYYY年MM月DD日 HH:mm',
  'MM/DD/YYYY HH:mm',
  'DD/MM/YYYY HH:mm',
  // 12 小时制
  'YYYY-MM-DD hh:mm:ss A',
  'YYYY-MM-DD hh:mm A',
  // 仅日期
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYY.MM.DD',
  'YYYY年MM月DD日',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
]

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
    body('dateTimeFormat').optional().isIn(DATETIME_FORMATS),
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

    body('watermarkEnabled').optional().isBoolean(),
    body('watermarkServerEnabled').optional().isBoolean(),
    body('watermarkScope').optional().isIn(['all', 'exam']),
    body('watermarkContent').optional().isString().isLength({ min: 0, max: 200 }),
    body('watermarkOpacity').optional().isFloat({ min: 0.02, max: 1 }),
    body('watermarkFontSize').optional().isInt({ min: 10, max: 48 }),
    body('watermarkRotate').optional().isInt({ min: -90, max: 90 }),
    body('watermarkGap').optional().isInt({ min: 20, max: 400 }),
    body('watermarkColor').optional().matches(/^#[0-9a-fA-F]{6}$/),

    body('aiEnabled').optional().isBoolean(),
    body('aiProvider').optional().isIn(['deepseek', 'openai', 'custom', 'local']),
    body('aiBaseUrl').optional({ nullable: true }).isString().isLength({ min: 0, max: 300 }),
    body('aiApiKey').optional({ nullable: true }).isString().isLength({ min: 0, max: 300 }),
    body('aiModel').optional().isString().isLength({ min: 1, max: 100 }),
    body('aiAllowedModels').optional({ nullable: true }).isString().isLength({ min: 0, max: 500 }),
    body('aiTemperature').optional().isFloat({ min: 0, max: 2 }),
    body('aiMaxTokens').optional().isInt({ min: 1, max: 100000 }),
    body('aiTimeoutMs').optional().isInt({ min: 1000, max: 300000 }),
    body('aiThinkingMode').optional().isIn(['enabled', 'disabled']),
  ],
  validateRequest,
  wrap(AdminSettingsController.updateSettings)
)

export { router as adminSettingsRoutes }
export default router
