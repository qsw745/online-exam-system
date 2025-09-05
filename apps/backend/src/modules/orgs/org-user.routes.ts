// apps/backend/src/modules/orgs/org-user.routes.ts
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express'

// 控制器（ESM 需显式 .js 扩展）
import { OrgUserController } from './org-user.controller.js'

// 公共中间件（ESM 需显式 .js 扩展）
import { authenticateToken } from '../../common/middleware/auth.js'
import { requireRoleByIds } from '../../common/middleware/role-auth.js'

// 角色常量
import { ROLE_IDS } from '../../config/roles.js'

// 类型
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

/** 统一包装控制器为 RequestHandler，并捕获异步错误 */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 全局认证
router.use(authenticateToken)

/** 自检：GET /api/orgusers （确认模块是否已挂载）*/
// router.get('/', (_req, res) => {
//   res.json({
//     ok: true,
//     routes: [
//       'GET /',
//       'POST /:orgId/users',
//       'DELETE /:orgId/users/:userId',
//       'PUT /:orgId/users/:userId/primary',
//       'PUT /:fromOrgId/users/:userId/move/:toOrgId',
//     ],
//   })
// })

/**
 * GET /orgs/:orgId/users
 * 查询机构下的用户（分页/搜索/角色筛选/递归子机构）
 */
router.get('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgUserController.listUsers))

/** 批量把用户加入机构（仅管理员） */
router.post('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsers))

/** 从机构移除某个用户（仅管理员） */
router.delete('/:orgId/users/:userId', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.removeUser))

/** 将用户在某机构设为主组织（仅管理员） */
router.put('/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))

/** 从 A 机构移动到 B 机构（仅管理员） */
router.put(
  '/:fromOrgId/users/:userId/move/:toOrgId',
  requireRoleByIds([ROLE_IDS.ADMIN]),
  wrap(OrgUserController.moveUser)
)

// 关键：既导出具名，又导出默认，适配你的聚合器 pick()
export { router as orgUserRoutes }
export default router
