// apps/backend/src/routes/org.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { OrgController } from '../controllers/org.controller.js'
import { authenticateToken, requireRole } from '../middleware/auth.middleware.js'
import type { AuthRequest } from '../types/auth.js'

const router = Router()

/** 将控制器包装为 Express RequestHandler，并统一捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 全局认证
router.use(authenticateToken)

// 获取组织树（所有已启用组织，以树形返回）
router.get('/tree', requireRole(['admin', 'teacher']), wrap(OrgController.getTree))

// 获取组织列表（分页 / 平铺）
router.get('/', requireRole(['admin', 'teacher']), wrap(OrgController.list))

// 获取组织详情
router.get('/:id', requireRole(['admin', 'teacher']), wrap(OrgController.getById))

// 创建组织
router.post('/', requireRole(['admin']), wrap(OrgController.create))

// 更新组织
router.put('/:id', requireRole(['admin']), wrap(OrgController.update))

// 删除组织
router.delete('/:id', requireRole(['admin']), wrap(OrgController.delete))

// （可选）批量排序
router.put('/sort/batch', requireRole(['admin']), wrap(OrgController.batchSort))

// （可选）移动组织到新父节点
router.put('/:id/move', requireRole(['admin']), wrap(OrgController.move))

export { router as orgRoutes }
