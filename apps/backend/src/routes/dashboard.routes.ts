import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = Router();

// 获取仪表盘统计数据
router.get('/stats', auth, DashboardController.getStats);

export { router as dashboardRoutes };