// apps/backend/src/modules/profile/routes/profile.routes.ts
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { body } from 'express-validator'
import { authenticateToken } from '@/common/middleware/auth.js'
import { validateRequest } from '@/common/middleware/validation.js'
import { upload } from '@/common/middleware/upload.js' // ✅ 这里用 upload
import type { AuthRequest } from '@/types/auth.js'
import { ProfileController } from '../controllers/profile.controller.js'

const router = Router()

const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req: Request, res: Response, next: NextFunction) => {
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

router.use(authenticateToken)

// GET /profile
router.get('/', wrap(ProfileController.getProfile))

// PUT /profile
router.put(
    '/',
    [
        body('email').optional().isEmail().isLength({ max: 120 }),
        body('nickname').optional().isString().isLength({ min: 1, max: 50 }),
        body('phone').optional().isString().isLength({ min: 3, max: 30 }),
        body('bio').optional().isString().isLength({ max: 500 }),
        body('avatar').optional().isString().isLength({ max: 500 }),
        body('school').optional().isString().isLength({ max: 100 }),
        body('class_name').optional().isString().isLength({ max: 100 }),
    ],
    validateRequest,
    wrap(ProfileController.updateProfile)
)

/**
 * PUT /profile/avatar
 * - multipart/form-data: 字段名 'avatar'，走文件上传
 * - application/json:    body = { value: 'https://...' }
 */
const detectMultipart: RequestHandler = (req, _res, next) => {
    const ct = String(req.headers['content-type'] || '').toLowerCase()
    ;(req as any).__isMultipart = ct.includes('multipart/form-data')
    next()
}

const maybeRunMulter: RequestHandler = (req, res, next) => {
    if ((req as any).__isMultipart) {
        // ✅ 这里直接用 multer 实例的 single
        return upload.single('avatar')(req, res, next)
    }
    next()
}

router.put(
    '/avatar',
    detectMultipart,
    maybeRunMulter,
    // 仅当不是 multipart 时（即 JSON 方式）才校验 value
    body('value')
        .if((_v, { req }) => !(req as any).__isMultipart)
        .exists().withMessage('缺少头像地址')
        .bail()
        .isString().withMessage('头像地址必须为字符串')
        .isLength({ max: 500 }),
    validateRequest,
    wrap(ProfileController.updateAvatar)
)

export { router as profileRoutes }
export default router
