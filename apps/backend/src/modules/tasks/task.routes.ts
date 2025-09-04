// apps/backend/src/routes/task.routes.ts
import { Router, type RequestHandler } from 'express'
import { TaskController } from '../controllers/task.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'

/** 将控制器包装为标准 RequestHandler，避免 TS2769 的重载不匹配 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

const router = Router()

// 全局鉴权
router.use(authenticateToken)

// ⚠️ 先声明批量路由，避免被 `/:id/*` 吞掉
router.post('/batch/publish', wrap(TaskController.batchPublish))
router.post('/batch/unpublish', wrap(TaskController.batchUnpublish))

// 列表 & 详情
router.get('/', wrap(TaskController.list))
router.get('/:id', wrap(TaskController.get))

// CRUD
router.post('/', wrap(TaskController.create))
router.put('/:id', wrap(TaskController.update))
router.delete('/:id', wrap(TaskController.delete))

// 业务动作
router.post('/:id/submit', wrap(TaskController.submit))
router.post('/:id/publish', wrap(TaskController.publish))
router.post('/:id/unpublish', wrap(TaskController.unpublish))

export { router as taskRoutes }
