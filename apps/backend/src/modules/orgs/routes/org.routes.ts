import { Router, type RequestHandler, type Response } from 'express'
import { OrgController } from '../controllers/org.controller'
import { OrgUserController } from '../controllers/org-user.controller'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRoleByIds } from '@/common/middleware/role-auth'
import { ROLE_IDS } from '@/config/roles'
import type { AuthRequest } from '@/types/auth'

const router = Router()
const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req, res, next) => {
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

router.use(authenticateToken)

/** -------- 组织自身资源 -------- */
router.get(
    '/tree',
    requireRoleByIds([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]),
    wrap(OrgController.getTree)
)

router.get('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.list))

router.get('/:id', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.getById))

router.post('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.create))

router.put('/:id', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.update))

router.delete('/:id', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.delete))

router.put('/sort/batch', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.batchSort))

router.put('/:id/move', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.SUPER_ADMIN]), wrap(OrgController.move))

/** -------- 组织下的用户（关系型子资源，原 org-user 路由整体搬到这里） -------- */
// 按机构查询用户（支持 include_children / search / role）
router.get(
    '/:orgId/users',
    requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]),
    wrap(OrgUserController.listUsers)
)

// 批量按用户ID添加
router.post('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsers))

// 批量按邮箱添加
router.post('/:orgId/users/by-email', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsersByEmail))

// 从机构移除用户
router.delete('/:orgId/users/:userId', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.removeUser))

// 设置主机构（可路径带 orgId，或 body 带 orgId）
router.put('/:orgId/users/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))
router.put('/users/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))

// 在机构之间移动
router.put(
    '/:fromOrgId/users/:userId/move/:toOrgId',
    requireRoleByIds([ROLE_IDS.ADMIN]),
    wrap(OrgUserController.moveUser)
)

export { router as orgRoutes }
export default router
