// apps/backend/src/modules/auth/routes/captcha.routes.ts
import { Router } from 'express'
import CaptchaController from '../controllers/captcha.controller'

const router = Router()

/**
 * 两种取法：
 * 1) <img src="/api/captcha/new"> —— 返回 image/svg+xml
 * 2) GET /api/captcha/new.json  —— 返回 { id, svg, ttl }
 */
router.get('/new', CaptchaController.newSvg)
router.get('/new.json', CaptchaController.newJson)

/** 校验 */
router.post('/verify', CaptchaController.verify)

export { router as captchaRoutes }
export default router
