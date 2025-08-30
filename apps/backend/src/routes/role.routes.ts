// apps/backend/src/routes/role.routes.ts
import { Router, type RequestHandler } from 'express'
import { ROLE_IDS } from '../constants/roles.js'
import {
  addUsersToRole,
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
  updateRole,
} from '../controllers/role.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { requireRole } from '../middleware/roleAuth.js'

/** 将任意 (req, res) => Promise 的控制器包装为标准 RequestHandler，避免 TS2769 */
type AnyAsyncController = (req: any, res: any) => any | Promise<any>
const wrap = (fn: AnyAsyncController): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }
}

const router = Router()

// 所有路由都需要认证
router.use(authenticateToken)

// 角色管理路由
router.get('/', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), wrap(getAllRoles))
router.get('/next-sort-order', wrap(getNextSortOrder)) // 暂时移除权限限制以便测试
router.get('/:id', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), wrap(getRoleById))
router.post('/', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(createRole))
router.put('/:id', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(updateRole))
router.delete('/:id', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(deleteRole))

// 角色菜单权限管理
router.get('/:id/menus', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), wrap(getRoleMenus))
router.put('/:id/menus', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(setRoleMenus))

// 用户角色管理
router.get('/users/:userId/roles', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), wrap(getUserRoles))
router.put('/users/:userId/roles', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(setUserRoles))

// 角色用户管理
router.get('/:roleId/users', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), wrap(getRoleUsers))
router.post('/:roleId/users', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(addUsersToRole))
// ✨ 新增删除单个成员
router.delete('/:roleId/users/:userId', requireRole([ROLE_IDS.SUPER_ADMIN]), wrap(removeUserFromRole))
export default router
