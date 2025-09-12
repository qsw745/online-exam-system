import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express'
import { OrgUserController } from '../controllers/org-user.controller'
import { authenticateToken } from '@/common/middleware/auth'
import { requireRoleByIds } from '@/common/middleware/role-auth'
import { ROLE_IDS } from '@/config/roles'
import type { AuthRequest } from 'types/auth'

const router = Router()
const wrap =
    (handler: (req: AuthRequest, res: Response) => Promise<unknown> | unknown): RequestHandler =>
        (req: Request, res: Response, next: NextFunction) => {
            Promise.resolve(handler(req as AuthRequest, res)).catch(next)
        }

router.use(authenticateToken)

// 按机构查询用户
router.get('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgUserController.listUsers))
// 兼容旧用法：?orgId=xxx
router.get('/', requireRoleByIds([ROLE_IDS.ADMIN, ROLE_IDS.TEACHER]), wrap(OrgUserController.listUsers))

// 批量按用户ID添加
router.post('/:orgId/users', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsers))

// ✅ 新增：批量按邮箱添加
router.post('/:orgId/users/by-email', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.addUsersByEmail))

// 从机构移除用户
router.delete('/:orgId/users/:userId', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.removeUser))

// 设置主机构（可路径带 orgId，或 body 带 orgId）
router.put('/:orgId/users/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))
router.put('/:userId/primary', requireRoleByIds([ROLE_IDS.ADMIN]), wrap(OrgUserController.setPrimary))

// 在机构之间移动
router.put(
    '/:fromOrgId/users/:userId/move/:toOrgId',
    requireRoleByIds([ROLE_IDS.ADMIN]),
    wrap(OrgUserController.moveUser)
)

export { router as orgUserRoutes }
export default router
