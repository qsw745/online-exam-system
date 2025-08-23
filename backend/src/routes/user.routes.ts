import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { auth, checkRole } from '../middleware/auth.middleware.js';
import { avatarUpload } from '../middleware/upload.middleware.js';

const router = Router();

// 获取当前用户信息
router.get('/me', auth, UserController.getCurrentUser);

// 更新当前用户信息
router.put('/me', auth, UserController.updateCurrentUser);

// 上传当前用户头像
router.post('/me/avatar', auth, avatarUpload, UserController.uploadAvatar);

// 获取用户设置
router.get('/settings', auth, UserController.getSettings);

// 保存用户设置
router.post('/settings', auth, UserController.saveSettings);

// 获取用户列表（仅管理员和教师可访问）
router.get('/', auth, checkRole(['admin', 'teacher']), UserController.list);

// 获取指定用户详情（仅管理员和教师可访问）
router.get('/:id', auth, checkRole(['admin', 'teacher']), UserController.getById);

// 更新用户信息（仅管理员可访问）
router.put('/:id', auth, checkRole(['admin']), UserController.update);

export { router as userRoutes };