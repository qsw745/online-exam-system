import { Router } from 'express'
import { MenuController } from '../controllers/menu.controller.js'
import { authenticateToken, optionalAuth } from '@/common/middleware/auth.js'

const router = Router()

/**
 * 说明：
 * 1) 所有“读取类”接口允许用 scope 区分：
 *    - ?scope=system 仅系统菜单（is_system=1）
 *    - ?scope=unit   仅单位菜单（is_system=0，必要时可再加 unit_id 过滤）
 *    - 省略则返回全部（谨慎使用，仅管理页可能会用到）
 * 2) “写入类”接口（POST/PUT/DELETE/批量排序）统一在 Service 层做保护：
 *    - createMenu：强制 is_system=false
 *    - updateMenu / deleteMenu：若目标 is_system=1 则拒绝
 */

// ---- 前端动态路由树
router.get('/route-tree', MenuController.getRouteTreeForFrontend)

// ---- 菜单（读）
router.get('/', MenuController.getAllMenus)             // 可带 ?scope=system|unit&unitId=xxx
router.get('/tree', MenuController.getMenuTree)         // 可带 ?scope=system|unit&unitId=xxx


// 便捷别名（前端好记忆，可选）
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

// ---- 用户角色与权限
router.post('/users/:userId/roles', authenticateToken, MenuController.assignUserRoles)
router.get('/users/:userId/roles', authenticateToken, MenuController.getUserRoles)
router.get('/users/:userId/permissions', optionalAuth, MenuController.getUserMenuPermissions)
router.get('/users/:userId/menus', optionalAuth, MenuController.getUserMenuTree)
router.get('/users/:userId/menus/:menuId/permission', optionalAuth, MenuController.checkUserMenuPermission)
router.post('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.setUserMenuPermission)
router.delete('/users/:userId/menus/:menuId/permission', authenticateToken, MenuController.removeUserMenuPermission)

// ---- 当前用户
router.get('/current-user/menus', authenticateToken, MenuController.getCurrentUserMenuTree)

router.get('/:id(\\d+)', MenuController.getMenuById)


export { router as menusRoutes }
export default router
