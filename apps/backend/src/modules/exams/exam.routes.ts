// apps/backend/src/modules/exams/exam.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { ExamController } from './exam.controller.js'
import { authenticateToken, requireRole } from '@common/middleware/auth.js'
import type { AuthRequest } from 'types/auth.js'

const router = Router()

/** 兼容 NodeNext + TS 的角色中间件签名（某些项目里 requireRole 的声明是 number[]） */
const requireRoleStr = requireRole as unknown as (roles: string[]) => RequestHandler

/** 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 获取考试列表
router.get('/', authenticateToken, wrap(ExamController.list))

// 获取考试详情
router.get('/:id', authenticateToken, wrap(ExamController.getById))

// 创建考试（仅教师和管理员可访问）
router.post('/', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.create))

// 更新考试（仅教师和管理员可访问）
router.put('/:id', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.update))

// 删除考试（仅教师和管理员可访问）
router.delete('/:id', authenticateToken, requireRoleStr(['admin', 'teacher']), wrap(ExamController.delete))

// 开始考试
router.post('/:id/start', authenticateToken, wrap(ExamController.start))

// 提交考试
router.post('/:id/submit', authenticateToken, wrap(ExamController.submit))

export { router as examRoutes }
