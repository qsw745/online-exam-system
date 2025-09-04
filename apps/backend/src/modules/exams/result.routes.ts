// apps/backend/src/routes/result.routes.ts
import { Router, type RequestHandler } from 'express'
import { ResultController } from '../controllers/result.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'

const router = Router()

/** 将任意 (req, res) => Promise 的控制器包装成标准 RequestHandler */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

// 获取考试结果列表
router.get('/', authenticateToken, wrap(ResultController.list))

// 获取考试结果详情
router.get('/:id', authenticateToken, wrap(ResultController.getById))

export { router as resultRoutes }
