import { Router, type RequestHandler } from 'express'
import {
    checkCode,
    createRole,
    deleteRole,
    getAllRoles,
    getNextSortOrder,
    getRoleById,
    getRoleMenus,
    getRoleUsers,
    getUserRoles,
    removeUserFromRole,
    setRoleMenus,
    setUserRoles,
    suggestCode,
    updateRole,
    getRoleEffectiveMenus,
    addUsersToRole,
    // 角色⇄机构
    getRoleOrgs,
    addRoleOrgs,
    removeRoleOrg,
} from '../controllers/role.controller.js'
import { authenticateToken } from '../../../common/middleware/auth.js'
import { requireRole } from '../../../common/middleware/role-auth.js'

type AnyAsync = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsync): RequestHandler => (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
}

const router = Router()
router.use(authenticateToken)

const ADMIN_ONLY = ['super_admin'] as const
const ADMIN_AND_SUPER = ['super_admin', 'admin'] as const

// 编码校验/建议
router.get('/check-code', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(checkCode))
router.get('/suggest-code', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(suggestCode))

// 角色管理（全局）
router.get('/', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getAllRoles))
router.get('/next-sort-order', wrap(getNextSortOrder))
router.get('/:id(\\d+)', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleById))
router.post('/', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(createRole))
router.put('/:id(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(updateRole))
router.delete('/:id(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(deleteRole))

// 菜单权限
router.get('/:id(\\d+)/menus', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleMenus))
router.put('/:id(\\d+)/menus', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(setRoleMenus))
// 生效菜单
router.get('/:id(\\d+)/menus/effective', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleEffectiveMenus))

// 角色 ⇄ 机构（兼容旧前端；基于 roles.org_id 一对一）
router.get('/:id(\\d+)/orgs', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleOrgs))
router.post('/:id(\\d+)/orgs', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(addRoleOrgs))
router.delete('/:id(\\d+)/orgs/:orgId(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(removeRoleOrg))

// 用户 ⇄ 角色（按用户）
router.get('/users/:userId(\\d+)/roles', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getUserRoles))
router.put('/users/:userId(\\d+)/roles', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(setUserRoles))

// 角色 ⇄ 用户（按角色）
router.get('/:roleId(\\d+)/users', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleUsers))
router.post('/:roleId(\\d+)/users', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(addUsersToRole))
router.delete('/:roleId(\\d+)/users/:userId(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(removeUserFromRole))

export default router
export { router as roleRoutes }
