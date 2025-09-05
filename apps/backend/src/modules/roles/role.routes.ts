import { Router, type RequestHandler } from 'express'

// 控制器
import {
  addUsersToRole,
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
  getRoleOrgs,
  addRoleOrgs,
  removeRoleOrg,
} from './role.controller.js'

// 中间件
import { authenticateToken } from '../../common/middleware/auth.js'
import { requireRole } from '../../common/middleware/role-auth.js'

// 包装工具
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

const router = Router()

// 统一认证
router.use(authenticateToken)

// 角色字符串常量
const ADMIN_ONLY = ['super_admin'] as const
const ADMIN_AND_SUPER = ['super_admin', 'admin'] as const

// 便捷校验/推荐编码
router.get('/check-code', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(checkCode))
router.get('/suggest-code', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(suggestCode))

// 角色管理（数字 ID 约束）
router.get('/', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getAllRoles))
router.get('/next-sort-order', wrap(getNextSortOrder)) // 暂放开测试
router.get('/:id(\\d+)', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleById))
router.post('/', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(createRole))
router.put('/:id(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(updateRole))
router.delete('/:id(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(deleteRole))

// 角色菜单权限
router.get('/:id(\\d+)/menus', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleMenus))
router.put('/:id(\\d+)/menus', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(setRoleMenus))

// 用户角色
router.get('/users/:userId(\\d+)/roles', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getUserRoles))
router.put('/users/:userId(\\d+)/roles', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(setUserRoles))

// 角色 ⇄ 用户
router.get('/:roleId(\\d+)/users', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleUsers))
router.post('/:roleId(\\d+)/users', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(addUsersToRole))
router.delete(
  '/:roleId(\\d+)/users/:userId(\\d+)',
  requireRole([...ADMIN_ONLY] as unknown as any[]),
  wrap(removeUserFromRole)
)

// 角色 ⇄ 机构
router.get('/:id(\\d+)/orgs', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleOrgs))
router.post('/:id(\\d+)/orgs', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(addRoleOrgs))
router.delete('/:id(\\d+)/orgs/:orgId(\\d+)', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(removeRoleOrg))

export default router
export { router as roleRoutes }
