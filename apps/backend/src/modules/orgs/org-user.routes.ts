// apps/backend/src/modules/orgs/org-user.routes.ts
import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express'

// 控制器与本文件同目录（ESM 需显式 .js 扩展名）
import { OrgUserController } from './org-user.controller.js'

// 公共中间件位于 common/middleware（ESM 需显式 .js 扩展名）
import { authenticateToken } from '../../common/middleware/auth.js'
import { requireRoleByIds } from '../../common/middleware/role-auth.js'

// 角色常量（使用数值 ID，避免 TS2322）
import { ROLE_IDS } from '../../config/roles.js'

// 类型（ESM 需显式 .js 扩展名）
import type { AuthRequest } from '../../types/auth.js'

const router = Router()

/** 将控制器包装为 Express RequestHandler，并统一捕获异步错误（显式类型以避免隐式 any） */
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req as AuthRequest, res)).catch(next)
  }

// 全局认证
router.use(authenticateToken)

/**
 * GET /orgs/:orgId/users
 * 查询机构下的用户（支持分页/搜索/角色筛选/是否含子部门）
 * 这里按「角色ID」检查，替代原先的字符串数组，修复 TS2322。
 */
router.get('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgUserController.listUsers))

/**
 * POST /orgs/:orgId/users
 * 批量把用户加入机构（仅管理员）
 */
router.post('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsers))

/**
 * DELETE /orgs/:orgId/users/:userId
 * 从机构移除某个用户（仅管理员）
 */
router.delete('/:orgId/users/:userId', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.removeUser))

/**
 * PUT /orgs/:orgId/users/:userId/primary
 * 将用户在某机构设为主组织（仅管理员）
 */
router.put('/:orgId/users/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))

/** 从 A 机构移动到 B 机构（移动后不在 A） */
router.put(
  '/:fromOrgId/users/:userId/move/:toOrgId',
  requireRoleByIds([ROLE_IDS.ADMIN]),
  wrap(OrgUserController.moveUser)
)

/** 给某用户一次性关联多个机构（可选设定主组织） */
router.post('/users/:userId/orgs', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.linkUserOrgs))

export { router as orgUserRoutes }
