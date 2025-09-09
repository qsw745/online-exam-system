import { Router, type RequestHandler } from 'express'
import { PasswordResetController } from '../controllers/password-reset.controller.js'
import { authenticateToken } from '@common/middleware/auth.js'
import type { AuthRequest } from 'types/auth.js'

const router = Router()
const requireAdmin: RequestHandler = (req, res, next) => {
  const role = (req as AuthRequest).user?.role
  return role === 'admin' ? next() : res.status(403).json({ success: false, message: '权限不足（需要管理员）' })
}

router.post('/forgot-password', PasswordResetController.forgotPassword)
router.get('/validate-token/:token', PasswordResetController.validateResetToken)
router.post('/reset-password', PasswordResetController.resetPassword)
router.delete('/clean-expired-tokens', authenticateToken, requireAdmin, PasswordResetController.cleanExpiredTokens)

export { router as passwordResetRoutes }
