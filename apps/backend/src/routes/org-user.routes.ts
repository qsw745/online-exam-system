// src/routes/org-user.routes.ts
import { Router } from 'express'
import { auth, requireRole } from '../middleware/auth.middleware.js'
import { OrgUserController } from '../controllers/org-user.controller.js'

const router = Router()

/**
 * GET /orgs/:orgId/users
 * 查询机构下的用户（支持分页/搜索/角色筛选/是否含子部门）
 * Query:
 *  - page?: number
 *  - limit?: number
 *  - search?: string
 *  - role?: string
 *  - include_children?: 0 | 1
 */
router.get('/:orgId/users', auth, requireRole(['admin', 'teacher']), OrgUserController.listUsers)

/**
 * POST /orgs/:orgId/users
 * 批量把用户加入机构
 * Body:
 *  - { user_ids: number[] }
 */
router.post('/:orgId/users', auth, requireRole(['admin']), OrgUserController.addUsers)

/**
 * DELETE /orgs/:orgId/users/:userId
 * 从机构移除某个用户
 */
router.delete('/:orgId/users/:userId', auth, requireRole(['admin']), OrgUserController.removeUser)

export { router as orgUserRoutes }
