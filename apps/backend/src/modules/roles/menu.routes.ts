// apps/backend/src/modules/roles/menu.routes.ts
import { Router, type RequestHandler } from 'express'

// 控制器（同目录）
import { MenuController } from './menu.controller.js'

// 中间件（src/common/middleware/auth.ts）
import { authenticateToken, optionalAuth } from '../../common/middleware/auth.js'

/** 将任意 (req, res) => Promise 的控制器包装为标准 RequestHandler，避免 TS2769 */
type AnyAsync = (req: any, res: any) => any | Promise<any>
const wrap =
  (fn: AnyAsync): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next)
  }

const router = Router()

// ---- 菜单（公共查询）----
router.get('/menus', wrap(MenuController.getAllMenus))
router.get('/menus/tree', wrap(MenuController.getMenuTree))
router.get('/menus/:id', wrap(MenuController.getMenuById))
router.post('/menus', authenticateToken, wrap(MenuController.createMenu))
router.put('/menus/:id', authenticateToken, wrap(MenuController.updateMenu))
router.delete('/menus/:id', authenticateToken, wrap(MenuController.deleteMenu))
router.post('/menus/batch-sort', authenticateToken, wrap(MenuController.batchUpdateMenuSort))

// ---- 角色（需要登录）----
router.get('/roles', authenticateToken, wrap(MenuController.getAllRoles))
router.get('/roles/:id', authenticateToken, wrap(MenuController.getRoleById))
router.post('/roles', authenticateToken, wrap(MenuController.createRole))
router.put('/roles/:id', authenticateToken, wrap(MenuController.updateRole))
router.delete('/roles/:id', authenticateToken, wrap(MenuController.deleteRole))
router.post('/roles/:roleId/menus', authenticateToken, wrap(MenuController.assignRoleMenus))
router.get('/roles/:roleId/menus', authenticateToken, wrap(MenuController.getRoleMenus))

// ---- 用户角色分配（需要登录）----
router.post('/users/:userId/roles', authenticateToken, wrap(MenuController.assignUserRoles))
router.get('/users/:userId/roles', authenticateToken, wrap(MenuController.getUserRoles))

// ---- 用户权限/菜单（登录可选：查询某用户可匿名，current-user 必须登录）----
router.get('/users/:userId/permissions', optionalAuth, wrap(MenuController.getUserMenuPermissions))
router.get('/users/:userId/menus', optionalAuth, wrap(MenuController.getUserMenuTree))
router.get('/users/:userId/menus/:menuId/permission', optionalAuth, wrap(MenuController.checkUserMenuPermission))
router.post('/users/:userId/menus/:menuId/permission', authenticateToken, wrap(MenuController.setUserMenuPermission))
router.delete(
  '/users/:userId/menus/:menuId/permission',
  authenticateToken,
  wrap(MenuController.removeUserMenuPermission)
)

// ---- 当前登录用户菜单（必须登录，否则 req.user 为空）----
router.get('/current-user/menus', authenticateToken, wrap(MenuController.getCurrentUserMenuTree))

// ---- 前端动态路由树（通常是公共的）----
router.get('/route-tree', wrap(MenuController.getRouteTreeForFrontend))

export default router
