import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller.js';

const router = Router();

// 菜单管理路由

// 菜单相关路由
router.get('/menus', MenuController.getAllMenus);
router.get('/menus/tree', MenuController.getMenuTree);
router.get('/menus/:id', MenuController.getMenuById);
router.post('/menus', MenuController.createMenu);
router.put('/menus/:id', MenuController.updateMenu);
router.delete('/menus/:id', MenuController.deleteMenu);
router.post('/menus/batch-sort', MenuController.batchUpdateMenuSort);

// 角色相关路由
router.get('/roles', MenuController.getAllRoles);
router.get('/roles/:id', MenuController.getRoleById);
router.post('/roles', MenuController.createRole);
router.put('/roles/:id', MenuController.updateRole);
router.delete('/roles/:id', MenuController.deleteRole);

// 角色菜单权限路由
router.post('/roles/:roleId/menus', MenuController.assignRoleMenus);
router.get('/roles/:roleId/menus', MenuController.getRoleMenus);

// 用户角色分配路由
router.post('/users/:userId/roles', MenuController.assignUserRoles);
router.get('/users/:userId/roles', MenuController.getUserRoles);

// 用户菜单权限路由
router.get('/users/:userId/permissions', MenuController.getUserMenuPermissions);
router.get('/users/:userId/menus', MenuController.getUserMenuTree);
router.get('/users/:userId/menus/:menuId/permission', MenuController.checkUserMenuPermission);
router.post('/users/:userId/menus/:menuId/permission', MenuController.setUserMenuPermission);
router.delete('/users/:userId/menus/:menuId/permission', MenuController.removeUserMenuPermission);

// 当前用户菜单路由
router.get('/current-user/menus', MenuController.getCurrentUserMenuTree);

export default router;