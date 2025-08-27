import { Router } from 'express';
import { PasswordResetController } from '../controllers/password-reset.controller.js';
import { auth, requireRole } from '../middleware/auth.middleware.js'

const router = Router();

// 忘记密码 - 发送重置邮件
router.post('/forgot-password', PasswordResetController.forgotPassword);

// 验证重置令牌
router.get('/validate-token/:token', PasswordResetController.validateResetToken);

// 重置密码
router.post('/reset-password', PasswordResetController.resetPassword);

// 清理过期令牌（仅管理员）
router.delete('/clean-expired-tokens', auth, requireRole(['admin']), PasswordResetController.cleanExpiredTokens)

export { router as passwordResetRoutes };
