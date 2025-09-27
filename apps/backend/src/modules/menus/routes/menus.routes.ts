import { Router } from 'express'
import { MenuController } from '../controllers/menu.controller.js'
import { authenticateToken, optionalAuth } from '@/common/middleware/auth.js'

const router = Router()

// ---- 功能菜单（系统功能路由树）
router.get('/functions/tree', MenuController.getFunctionsTree)
// 兼容老路径
router.get('/route-tree', MenuController.getFunctionsTree)

// ---- 菜单（读）
router.get('/', MenuController.getAllMenus)             // ?scope=system|unit&unitId=xxx
router.get('/tree', MenuController.getMenuTree)         // ?scope=system|unit&unitId=xxx

// 便捷别名（可选）
router.get('/tree/system', (req, res) => {
    (req.query as any).scope = 'system'; return MenuController.getMenuTree(req, res)
})
router.get('/tree/unit', (req, res) => {
    (req.query as any).scope = 'unit';   return MenuController.getMenuTree(req, res)
})

// ---- 菜单（写）
router.post('/', authenticateToken, MenuController.createMenu)
router.put('/:id', authenticateToken, MenuController.updateMenu)
router.delete('/:id', authenticateToken, MenuController.deleteMenu)
router.post('/batch-sort', authenticateToken, MenuController.batchUpdateMenuSort)

// ---- 角色
router.get('/roles', authenticateToken, MenuController.getAllRoles)
router.get('/roles/:id', authenticateToken, MenuController.getRoleById)
router.post('/roles', authenticateToken, MenuController.createRole)
router.put('/roles/:id', authenticateToken, MenuController.updateRole)
router.delete('/roles/:id', authenticateToken, MenuController.deleteRole)
router.post('/roles/:roleId/menus', authenticateToken, MenuController.assignRoleMenus)
router.get('/roles/:roleId/menus', authenticateToken, MenuController.getRoleMenus)

// ---- 用户角色与权限 / 单位菜单（按角色）
router.post('/users/:userId/roles', authenticateToken, MenuController.assignUserRoles)
router.get('/users/:userId/roles', authenticateToken, MenuController.getUserRoles)
router.get('/users/:userId/permissions', optionalAuth, MenuController.getUserMenuPermissions)
router.get('/users/:userId/menus', optionalAuth, MenuController.getUserMenuTree)
router.get('/users/:userId/menus/:menuId/permission', optionalAuth, MenuController.checkUserMenuPermission)
router.post('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.setUserMenuPermission)
router.delete('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.removeUserMenuPermission)

// ---- 当前用户
router.get('/current-user/menus', authenticateToken, MenuController.getCurrentUserMenuTree)

// 单条
router.get('/:id(\\d+)', MenuController.getMenuById)

// 生效菜单（单位）——用于角色授权弹窗
router.get('/effective', MenuController.getEffectiveMenus)

export { router as menusRoutes }
export default router
