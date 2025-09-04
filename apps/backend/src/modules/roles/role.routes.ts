// apps/backend/src/modules/roles/role.routes.ts
import { Router, type RequestHandler } from 'express'

// 控制器（同目录）
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

/** 将任意 (req, res) => Promise 的控制器包装为标准 RequestHandler，避免 TS2769 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

const router = Router()

// 统一认证
router.use(authenticateToken)

// 角色字符串常量（替代原 ROLE_IDS）
const ADMIN_ONLY = ['super_admin'] as const
const ADMIN_AND_SUPER = ['super_admin', 'admin'] as const

// 便捷校验/推荐编码
router.get('/check-code', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(checkCode))
router.get('/suggest-code', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(suggestCode))

// 角色管理路由
router.get('/', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getAllRoles))
router.get('/next-sort-order', wrap(getNextSortOrder)) // 暂时放开以便测试
router.get('/:id', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleById))
router.post('/', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(createRole))
router.put('/:id', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(updateRole))
router.delete('/:id', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(deleteRole))

// 角色菜单权限管理
router.get('/:id/menus', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleMenus))
router.put('/:id/menus', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(setRoleMenus))

// 用户角色管理
router.get('/users/:userId/roles', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getUserRoles))
router.put('/users/:userId/roles', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(setUserRoles))

// 角色用户管理
router.get('/:roleId/users', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleUsers))
router.post('/:roleId/users', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(addUsersToRole))
router.delete('/:roleId/users/:userId', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(removeUserFromRole))

// 角色 ⇄ 机构
router.get('/:id/orgs', requireRole([...ADMIN_AND_SUPER] as unknown as any[]), wrap(getRoleOrgs))
router.post('/:id/orgs', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(addRoleOrgs))
router.delete('/:id/orgs/:orgId', requireRole([...ADMIN_ONLY] as unknown as any[]), wrap(removeRoleOrg))

export default router
