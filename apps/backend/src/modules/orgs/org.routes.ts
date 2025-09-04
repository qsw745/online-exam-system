// apps/backend/src/modules/orgs/org.routes.ts
import { Router, type RequestHandler, type Response } from 'express'

// 控制器在同目录（ESM 需显式 .js）
import { OrgController } from './org.controller.js'

// 认证与角色中间件在 common/middleware 下（ESM 需显式 .js）
import { authenticateToken } from '../../common/middleware/auth.js'
import { requireRoleByIds } from '../../common/middleware/role-auth.js'

// 角色常量：按数值ID检查，避免 TS2322
import { ROLE_IDS } from '../../config/roles.js'

// 类型（ESM 需显式 .js）
import type { AuthRequest } from '../../types/auth.js'

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
router.get('/tree', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgController.getTree))

// 获取组织列表（分页 / 平铺）
router.get('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgController.list))

// 获取组织详情
router.get('/:id', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgController.getById))

// 创建组织
router.post('/', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgController.create))

// 更新组织
router.put('/:id', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgController.update))

// 删除组织
router.delete('/:id', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgController.delete))

// 批量仅更新 parent_id（无排序列）
router.put('/sort/batch', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgController.batchSort))

// 移动组织到新父节点
router.put('/:id/move', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgController.move))

export { router as orgRoutes }
