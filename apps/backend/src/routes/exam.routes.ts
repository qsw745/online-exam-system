import { Router } from 'express';
import { ExamController } from '../controllers/exam.controller.js';
import { auth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// 获取考试列表
router.get('/', auth, ExamController.list);

// 获取考试详情
router.get('/:id', auth, ExamController.getById);

// 创建考试（仅教师和管理员可访问）
router.post('/', auth, requireRole(['admin', 'teacher']), ExamController.create)

// 更新考试（仅教师和管理员可访问）
router.put('/:id', auth, requireRole(['admin', 'teacher']), ExamController.update)

// 删除考试（仅教师和管理员可访问）
router.delete('/:id', auth, requireRole(['admin', 'teacher']), ExamController.delete)

// 开始考试
router.post('/:id/start', auth, ExamController.start);

// 提交考试
router.post('/:id/submit', auth, ExamController.submit);

export { router as examRoutes };
