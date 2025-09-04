// apps/backend/src/modules/exams/result.routes.ts
import { Router, type RequestHandler, type NextFunction, type Response } from 'express'

// 控制器（同目录）
import { ResultController } from './result.controller.js'

// 认证中间件（src/common/middleware/auth.ts）
import { authenticateToken } from '../../common/middleware/auth.js'

const router = Router()

/** 通用包装器：用 any 避免与控制器的 AuthRequest 类型冲突（NodeNext 下更省心） */
type AnyAsyncController = (req: any, res: Response) => unknown | Promise<unknown>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

// 统一加认证
router.use(authenticateToken)

// 获取考试结果列表
router.get('/', wrap(ResultController.list))

// 获取考试结果详情
router.get('/:id', wrap(ResultController.getById))

export { router as resultRoutes }
