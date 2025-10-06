// apps/backend/src/modules/auth/routes/auth.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import type { AuthRequest } from '@/types/auth.js'
import { AuthController } from '../controllers/auth.controller.js'
import { PasswordResetController } from '../controllers/password-reset.controller.js'

const router = Router()

const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 这些接口都不应被 access-token 鉴权中间件拦住
router.post('/register', wrap(AuthController.register))
router.post('/login', wrap(AuthController.login))
// ✅ 兼容前端 httpClient 的 GET 兜底
router.get('/refresh', wrap(AuthController.refresh))
router.post('/refresh', wrap(AuthController.refresh))
router.post('/logout', wrap(AuthController.logout))

// 兼容旧路由（建议迁到 password-reset.routes.ts）
router.post('/password-reset/forgot', wrap(PasswordResetController.forgotPassword))

export { router as authRoutes }
export default router
