import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// 忘记密码相关路由
router.post('/password-reset/forgot', AuthController.forgotPassword);
router.post('/password-reset/validate', AuthController.validateResetToken);
router.post('/password-reset/reset', AuthController.resetPassword);

export { router as authRoutes };