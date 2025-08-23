import { Router } from 'express';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRoleMenus,
  setRoleMenus,
  getUserRoles,
  setUserRoles
} from '../controllers/role.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';

const router = Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 角色管理路由
router.get('/', requireRole(['super_admin', 'admin']), getAllRoles);
router.get('/:id', requireRole(['super_admin', 'admin']), getRoleById);
router.post('/', requireRole(['super_admin']), createRole);
router.put('/:id', requireRole(['super_admin']), updateRole);
router.delete('/:id', requireRole(['super_admin']), deleteRole);

// 角色菜单权限管理
router.get('/:id/menus', requireRole(['super_admin', 'admin']), getRoleMenus);
router.put('/:id/menus', requireRole(['super_admin']), setRoleMenus);

// 用户角色管理
router.get('/users/:userId/roles', requireRole(['super_admin', 'admin']), getUserRoles);
router.put('/users/:userId/roles', requireRole(['super_admin']), setUserRoles);

export default router;