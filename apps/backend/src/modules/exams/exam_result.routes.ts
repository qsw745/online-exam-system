// apps/backend/src/modules/exams/exam_result.routes.ts
import { Router, type RequestHandler, type Response, type NextFunction } from 'express'

// 控制器（同目录）
import { ResultController } from './result.controller.js'

// 认证中间件（src/common/middleware/auth.ts）
import { authenticateToken } from '../../common/middleware/auth.js'

// AuthRequest 类型（src/types/auth.ts）
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

/**
 * 将 (req: AuthRequest, res: Response) 控制器包装为 Express RequestHandler，
 * 统一捕获异步错误并保持类型安全。
 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 统一鉴权
router.use(authenticateToken)

// 获取考试结果列表
router.get('/', wrap(ResultController.list))

// 获取考试结果详情
router.get('/:id', wrap(ResultController.getById))

export { router as examResultRoutes }
