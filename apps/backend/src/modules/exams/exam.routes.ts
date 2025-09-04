// apps/backend/src/routes/exam.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { ExamController } from '../controllers/exam.controller.js'
import { auth, requireRole } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，
 * 既兼容类型，又统一捕获异步错误。
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取考试列表
router.get('/', auth, wrap(ExamController.list))

// 获取考试详情
router.get('/:id', auth, wrap(ExamController.getById))

// 创建考试（仅教师和管理员可访问）
router.post('/', auth, requireRole(['admin', 'teacher']), wrap(ExamController.create))

// 更新考试（仅教师和管理员可访问）
router.put('/:id', auth, requireRole(['admin', 'teacher']), wrap(ExamController.update))

// 删除考试（仅教师和管理员可访问）
router.delete('/:id', auth, requireRole(['admin', 'teacher']), wrap(ExamController.delete))

// 开始考试
router.post('/:id/start', auth, wrap(ExamController.start))

// 提交考试
router.post('/:id/submit', auth, wrap(ExamController.submit))

export { router as examRoutes }
