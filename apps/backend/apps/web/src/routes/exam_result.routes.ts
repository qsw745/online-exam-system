import { Router } from 'express';
import { ResultController } from '../controllers/result.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = Router();

// 获取考试结果列表
router.get('/', auth, ResultController.list);

// 获取考试结果详情
router.get('/:id', auth, ResultController.getById);

export { router as examResultRoutes };