// apps/backend/src/modules/menus/routes/menus.routes.ts
import { Router } from 'express'
import { MenuController } from '../controllers/menu.controller.js'
import { authenticateToken, optionalAuth } from '@common/middleware/auth.js'

const router = Router()

// 菜单
router.get('/', MenuController.getAllMenus)
router.get('/tree', MenuController.getMenuTree)
router.get('/:id', MenuController.getMenuById)
router.post('/', authenticateToken, MenuController.createMenu)
router.put('/:id', authenticateToken, MenuController.updateMenu)
router.delete('/:id', authenticateToken, MenuController.deleteMenu)
router.post('/batch-sort', authenticateToken, MenuController.batchUpdateMenuSort)

// 角色
router.get('/roles', authenticateToken, MenuController.getAllRoles)
router.get('/roles/:id', authenticateToken, MenuController.getRoleById)
router.post('/roles', authenticateToken, MenuController.createRole)
router.put('/roles/:id', authenticateToken, MenuController.updateRole)
router.delete('/roles/:id', authenticateToken, MenuController.deleteRole)
router.post('/roles/:roleId/menus', authenticateToken, MenuController.assignRoleMenus)
router.get('/roles/:roleId/menus', authenticateToken, MenuController.getRoleMenus)

// 用户角色与权限
router.post('/users/:userId/roles', authenticateToken, MenuController.assignUserRoles)
router.get('/users/:userId/roles', authenticateToken, MenuController.getUserRoles)

router.get('/users/:userId/permissions', optionalAuth, MenuController.getUserMenuPermissions)
router.get('/users/:userId/menus', optionalAuth, MenuController.getUserMenuTree)
router.get('/users/:userId/menus/:menuId/permission', optionalAuth, MenuController.checkUserMenuPermission)
router.post('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.setUserMenuPermission)
router.delete('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.removeUserMenuPermission)

// 当前用户
router.get('/current-user/menus', authenticateToken, MenuController.getCurrentUserMenuTree)

// 前端动态路由树
router.get('/route-tree', MenuController.getRouteTreeForFrontend)

export { router as menusRoutes }
export default router
