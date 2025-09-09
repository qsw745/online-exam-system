import { Router, type RequestHandler, type Response } from 'express'
import type { AuthRequest } from 'types/auth.js'
import { AuthController } from '../controllers/auth.controller.js'

const router = Router()
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

router.post('/register', wrap(AuthController.register))
router.post('/login', wrap(AuthController.login))
router.post('/refresh', wrap(AuthController.refresh))
router.post('/logout', wrap(AuthController.logout))

// 兼容旧路由（建议使用 password-reset.routes.ts）
router.post('/password-reset/forgot', wrap(AuthController.forgotPassword))

export { router as authRoutes }
