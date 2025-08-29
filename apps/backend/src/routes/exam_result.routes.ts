// apps/backend/src/routes/exam_result.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { ResultController } from '../controllers/result.controller.js'
import { auth } from '../middleware/auth.middleware.js'
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

// 获取考试结果列表
router.get('/', auth, wrap(ResultController.list))

// 获取考试结果详情
router.get('/:id', auth, wrap(ResultController.getById))

export { router as examResultRoutes }
