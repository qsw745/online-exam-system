// apps/backend/src/routes/org-user.routes.ts
import { Router, type RequestHandler, type Response } from 'express'
import { OrgUserController } from '../controllers/org-user.controller.js'
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

/**
 * GET /orgs/:orgId/users
 * 查询机构下的用户（支持分页/搜索/角色筛选/是否含子部门）
 */
router.get('/:orgId/users', requireRole(['admin', 'teacher']), wrap(OrgUserController.listUsers))

/**
 * POST /orgs/:orgId/users
 * 批量把用户加入机构（仅管理员）
 */
router.post('/:orgId/users', requireRole(['admin']), wrap(OrgUserController.addUsers))

/**
 * DELETE /orgs/:orgId/users/:userId
 * 从机构移除某个用户（仅管理员）
 */
router.delete('/:orgId/users/:userId', requireRole(['admin']), wrap(OrgUserController.removeUser))

/**
 * PUT /orgs/:orgId/users/:userId/primary
 * 将用户在某机构设为主组织（仅管理员）
 */
router.put('/:orgId/users/:userId/primary', requireRole(['admin']), wrap(OrgUserController.setPrimary))

export { router as orgUserRoutes }
