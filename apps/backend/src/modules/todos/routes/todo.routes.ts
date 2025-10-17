// apps/backend/src/modules/todos/routes/todo.routes.ts
import { Router, type RequestHandler, type Response, type NextFunction } from 'express'
import { TodoController } from '../controllers/todo.controller.js'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRole } from '@/common/middleware/role-auth'

const router = Router()

const wrap =
  (handler: (req: any, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next)
  }

router.use(authenticateToken)

// 用户侧
router.get('/', wrap(TodoController.list))
router.get('/pending-count', wrap(TodoController.pendingCount))
router.put('/:id/done', wrap(TodoController.markDone))
router.put('/done-all', wrap(TodoController.markAllDone))
router.delete('/:id', wrap(TodoController.delete))

// 管理侧（admin/teacher）
router.post('/', requireRole(['admin', 'teacher']), wrap(TodoController.create))
router.post('/batch', requireRole(['admin', 'teacher']), wrap(TodoController.createBatch))

// 仅 admin
router.get('/admin/list', requireRole(['admin']), wrap(TodoController.adminList))
router.delete('/admin/:id', requireRole(['admin']), wrap(TodoController.adminDelete))

export { router as todoRoutes }
export default router
