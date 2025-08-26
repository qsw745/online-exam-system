import { Router } from 'express';
import { LogController } from '../controllers/log.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = Router();

// 所有日志路由都需要认证
router.use(auth);

// 通用日志接口
router.get('/', LogController.getLogs);
router.get('/export', LogController.exportLogs);

// 获取用户操作日志
router.get('/user', LogController.getUserLogs);

// 获取系统日志（仅管理员）
router.get('/system', LogController.getSystemLogs);

// 获取审计日志（仅管理员）
router.get('/audit', LogController.getAuditLogs);

// 获取登录日志
router.get('/login', LogController.getLoginLogs);

// 获取考试日志
router.get('/exam/:examId', LogController.getExamLogs);

// 清理过期日志（仅管理员）
router.post('/cleanup', LogController.cleanupLogs);

export default router;