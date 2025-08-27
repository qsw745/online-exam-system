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
  setUserRoles,
  getRoleUsers,
  addUsersToRole,
  getNextSortOrder
} from '../controllers/role.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/roleAuth.js';
import { ROLE_IDS } from '../constants/roles.js';

const router = Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 角色管理路由
router.get('/', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), getAllRoles);
router.get('/next-sort-order', getNextSortOrder); // 暂时移除权限限制以便测试
router.get('/:id', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), getRoleById);
router.post('/', requireRole([ROLE_IDS.SUPER_ADMIN]), createRole);
router.put('/:id', requireRole([ROLE_IDS.SUPER_ADMIN]), updateRole);
router.delete('/:id', requireRole([ROLE_IDS.SUPER_ADMIN]), deleteRole);

// 角色菜单权限管理
router.get('/:id/menus', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), getRoleMenus);
router.put('/:id/menus', requireRole([ROLE_IDS.SUPER_ADMIN]), setRoleMenus);

// 用户角色管理
router.get('/users/:userId/roles', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), getUserRoles);
router.put('/users/:userId/roles', requireRole([ROLE_IDS.SUPER_ADMIN]), setUserRoles);

// 角色用户管理
router.get('/:roleId/users', requireRole([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN]), getRoleUsers);
router.post('/:roleId/users', requireRole([ROLE_IDS.SUPER_ADMIN]), addUsersToRole);

export default router;
