// apps/backend/src/modules/auth/auth.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { AuthController } from './auth.controller.js'
import type { AuthRequest } from 'types/auth.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 的控制器包装为 Express 标准的 RequestHandler
 * - 把 req 强转为 AuthRequest
 * - 捕获异步异常并交给 next()
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 注册 / 登录
router.post('/register', wrap(AuthController.register))
router.post('/login', wrap(AuthController.login))

// 忘记密码相关路由
router.post('/password-reset/forgot', wrap(AuthController.forgotPassword))
router.post('/password-reset/validate', wrap(AuthController.validateResetToken))
router.post('/password-reset/reset', wrap(AuthController.resetPassword))

export { router as authRoutes }
