// apps/backend/src/routes/menu.routes.ts
import { Router } from 'express'
import { MenuController } from '../controllers/menu.controller.js'
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware.js'

const router = Router()

// ---- 菜单（公共查询）----
router.get('/menus', MenuController.getAllMenus)
router.get('/menus/tree', MenuController.getMenuTree)
router.get('/menus/:id', MenuController.getMenuById)
router.post('/menus', authenticateToken, MenuController.createMenu)
router.put('/menus/:id', authenticateToken, MenuController.updateMenu)
router.delete('/menus/:id', authenticateToken, MenuController.deleteMenu)
router.post('/menus/batch-sort', authenticateToken, MenuController.batchUpdateMenuSort)

// ---- 角色（需要登录）----
router.get('/roles', authenticateToken, MenuController.getAllRoles)
router.get('/roles/:id', authenticateToken, MenuController.getRoleById)
router.post('/roles', authenticateToken, MenuController.createRole)
router.put('/roles/:id', authenticateToken, MenuController.updateRole)
router.delete('/roles/:id', authenticateToken, MenuController.deleteRole)
router.post('/roles/:roleId/menus', authenticateToken, MenuController.assignRoleMenus)
router.get('/roles/:roleId/menus', authenticateToken, MenuController.getRoleMenus)

// ---- 用户角色分配（需要登录）----
router.post('/users/:userId/roles', authenticateToken, MenuController.assignUserRoles)
router.get('/users/:userId/roles', authenticateToken, MenuController.getUserRoles)

// ---- 用户权限/菜单（登录可选：查询某用户可匿名，current-user 必须登录）----
router.get('/users/:userId/permissions', optionalAuth, MenuController.getUserMenuPermissions)
router.get('/users/:userId/menus', optionalAuth, MenuController.getUserMenuTree)
router.get('/users/:userId/menus/:menuId/permission', optionalAuth, MenuController.checkUserMenuPermission)
router.post('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.setUserMenuPermission)
router.delete('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.removeUserMenuPermission)

// ---- 当前登录用户菜单（必须登录，否则 req.user 为空）----
router.get('/current-user/menus', authenticateToken, MenuController.getCurrentUserMenuTree)

// ---- 前端动态路由树（通常是公共的）----
router.get('/route-tree', MenuController.getRouteTreeForFrontend)

export default router
