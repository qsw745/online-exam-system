// apps/backend/src/modules/auth/password-reset.routes.ts
import { Router, type RequestHandler } from 'express'
import { PasswordResetController } from './password-reset.controller.js'

// 使用你项目里的鉴权中间件（基于 @common 别名）
import { authenticateToken } from '@common/middleware/auth.js'
import type { AuthRequest } from 'types/auth.js'

const router = Router()

/** 本地管理员校验（避免 requireRole 的 number[] 签名导致 “string 不能分配给 number” 报错） */
const requireAdmin: RequestHandler = (req, res, next) => {
  const role = (req as AuthRequest).user?.role
  if (role === 'admin') return next()
  return res.status(403).json({ success: false, message: '权限不足（需要管理员）' })
}

// 忘记密码 - 发送重置邮件
router.post('/forgot-password', PasswordResetController.forgotPassword)

// 验证重置令牌
router.get('/validate-token/:token', PasswordResetController.validateResetToken)

// 重置密码
router.post('/reset-password', PasswordResetController.resetPassword)

// 清理过期令牌（仅管理员）
router.delete('/clean-expired-tokens', authenticateToken, requireAdmin, PasswordResetController.cleanExpiredTokens)

export { router as passwordResetRoutes }
