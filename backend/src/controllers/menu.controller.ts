import { Request, Response } from 'express';
import { MenuService } from '../services/menu.service.js';
import {
  CreateMenuRequest,
  UpdateMenuRequest,
  CreateRoleRequest,
  UpdateRoleRequest
} from '../models/menu.model.js';

export class MenuController {
  // 获取所有菜单
  static async getAllMenus(req: Request, res: Response) {
    try {
      const menus = await MenuService.getAllMenus();
      res.json({
        success: true,
        data: menus
      });
    } catch (error) {
      console.error('获取菜单列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取菜单列表失败'
      });
    }
  }

  // 获取菜单树
  static async getMenuTree(req: Request, res: Response) {
    try {
      const menuTree = await MenuService.getMenuTree();
      res.json({
        success: true,
        data: menuTree
      });
    } catch (error) {
      console.error('获取菜单树失败:', error);
      res.status(500).json({
        success: false,
        message: '获取菜单树失败'
      });
    }
  }

  // 根据ID获取菜单
  static async getMenuById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const menu = await MenuService.getMenuById(parseInt(id));
      
      if (!menu) {
        return res.status(404).json({
          success: false,
          message: '菜单不存在'
        });
      }
      
      res.json({
        success: true,
        data: menu
      });
    } catch (error) {
      console.error('获取菜单详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取菜单详情失败'
      });
    }
  }

  // 创建菜单
  static async createMenu(req: Request, res: Response) {
    try {
      const menuData: CreateMenuRequest = req.body;
      
      // 基本验证
      if (!menuData.name || !menuData.title) {
        return res.status(400).json({
          success: false,
          message: '菜单名称和标题不能为空'
        });
      }
      
      const menuId = await MenuService.createMenu(menuData);
      
      res.status(201).json({
        success: true,
        data: { id: menuId },
        message: '菜单创建成功'
      });
    } catch (error) {
      console.error('创建菜单失败:', error);
      res.status(500).json({
        success: false,
        message: '创建菜单失败'
      });
    }
  }

  // 更新菜单
  static async updateMenu(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: Omit<UpdateMenuRequest, 'id'> = req.body;
      
      const success = await MenuService.updateMenu({
        id: parseInt(id),
        ...updateData
      });
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: '菜单不存在或更新失败'
        });
      }
      
      res.json({
        success: true,
        message: '菜单更新成功'
      });
    } catch (error) {
      console.error('更新菜单失败:', error);
      res.status(500).json({
        success: false,
        message: '更新菜单失败'
      });
    }
  }

  // 删除菜单
  static async deleteMenu(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const success = await MenuService.deleteMenu(parseInt(id));
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: '菜单不存在或无法删除'
        });
      }
      
      res.json({
        success: true,
        message: '菜单删除成功'
      });
    } catch (error) {
      console.error('删除菜单失败:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '删除菜单失败'
      });
    }
  }

  // 获取所有角色
  static async getAllRoles(req: Request, res: Response) {
    try {
      const roles = await MenuService.getAllRoles();
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('获取角色列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色列表失败'
      });
    }
  }

  // 根据ID获取角色
  static async getRoleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const role = await MenuService.getRoleById(parseInt(id));
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: '角色不存在'
        });
      }
      
      res.json({
        success: true,
        data: role
      });
    } catch (error) {
      console.error('获取角色详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色详情失败'
      });
    }
  }

  // 创建角色
  static async createRole(req: Request, res: Response) {
    try {
      const roleData: CreateRoleRequest = req.body;
      
      // 基本验证
      if (!roleData.name || !roleData.code) {
        return res.status(400).json({
          success: false,
          message: '角色名称和编码不能为空'
        });
      }
      
      const roleId = await MenuService.createRole(roleData);
      
      res.status(201).json({
        success: true,
        data: { id: roleId },
        message: '角色创建成功'
      });
    } catch (error) {
      console.error('创建角色失败:', error);
      res.status(500).json({
        success: false,
        message: '创建角色失败'
      });
    }
  }

  // 更新角色
  static async updateRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: Omit<UpdateRoleRequest, 'id'> = req.body;
      
      const success = await MenuService.updateRole({
        id: parseInt(id),
        ...updateData
      });
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: '角色不存在或更新失败'
        });
      }
      
      res.json({
        success: true,
        message: '角色更新成功'
      });
    } catch (error) {
      console.error('更新角色失败:', error);
      res.status(500).json({
        success: false,
        message: '更新角色失败'
      });
    }
  }

  // 删除角色
  static async deleteRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const success = await MenuService.deleteRole(parseInt(id));
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: '角色不存在或无法删除'
        });
      }
      
      res.json({
        success: true,
        message: '角色删除成功'
      });
    } catch (error) {
      console.error('删除角色失败:', error);
      res.status(500).json({
        success: false,
        message: '删除角色失败'
      });
    }
  }

  // 为角色分配菜单权限
  static async assignRoleMenus(req: Request, res: Response) {
    try {
      const { roleId } = req.params;
      const { menuIds } = req.body;
      
      if (!Array.isArray(menuIds)) {
        return res.status(400).json({
          success: false,
          message: '菜单ID列表格式错误'
        });
      }
      
      const success = await MenuService.assignRoleMenus(parseInt(roleId), menuIds);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          message: '分配权限失败'
        });
      }
      
      res.json({
        success: true,
        message: '权限分配成功'
      });
    } catch (error) {
      console.error('分配角色菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '分配权限失败'
      });
    }
  }

  // 获取角色的菜单权限
  static async getRoleMenus(req: Request, res: Response) {
    try {
      const { roleId } = req.params;
      const menuIds = await MenuService.getRoleMenus(parseInt(roleId));
      
      res.json({
        success: true,
        data: menuIds
      });
    } catch (error) {
      console.error('获取角色菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '获取角色菜单权限失败'
      });
    }
  }

  // 为用户分配角色
  static async assignUserRoles(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { roleIds } = req.body;
      
      if (!Array.isArray(roleIds)) {
        return res.status(400).json({
          success: false,
          message: '角色ID列表格式错误'
        });
      }
      
      const success = await MenuService.assignUserRoles(parseInt(userId), roleIds);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          message: '分配角色失败'
        });
      }
      
      res.json({
        success: true,
        message: '角色分配成功'
      });
    } catch (error) {
      console.error('分配用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '分配角色失败'
      });
    }
  }

  // 获取用户的角色
  static async getUserRoles(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const roles = await MenuService.getUserRoles(parseInt(userId));
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('获取用户角色失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户角色失败'
      });
    }
  }

  // 获取用户的菜单权限
  static async getUserMenuPermissions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const permissions = await MenuService.getUserMenuPermissions(parseInt(userId));
      
      res.json({
        success: true,
        data: permissions
      });
    } catch (error) {
      console.error('获取用户菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户菜单权限失败'
      });
    }
  }

  // 获取用户可访问的菜单树
  static async getUserMenuTree(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const menuTree = await MenuService.getUserMenuTree(parseInt(userId));
      
      res.json({
        success: true,
        data: menuTree
      });
    } catch (error) {
      console.error('获取用户菜单树失败:', error);
      res.status(500).json({
        success: false,
        message: '获取用户菜单树失败'
      });
    }
  }

  // 获取当前用户的菜单树
  static async getCurrentUserMenuTree(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        });
      }
      
      const menuTree = await MenuService.getUserMenuTree(userId);
      
      res.json({
        success: true,
        data: menuTree
      });
    } catch (error) {
      console.error('获取当前用户菜单树失败:', error);
      res.status(500).json({
        success: false,
        message: '获取菜单失败'
      });
    }
  }

  // 检查用户菜单权限
  static async checkUserMenuPermission(req: Request, res: Response) {
    try {
      const { userId, menuId } = req.params;
      const hasPermission = await MenuService.checkUserMenuPermission(
        parseInt(userId),
        parseInt(menuId)
      );
      
      res.json({
        success: true,
        data: { hasPermission }
      });
    } catch (error) {
      console.error('检查用户菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '检查权限失败'
      });
    }
  }

  // 设置用户菜单权限
  static async setUserMenuPermission(req: Request, res: Response) {
    try {
      const { userId, menuId } = req.params;
      const { permissionType } = req.body;
      
      if (!['grant', 'deny'].includes(permissionType)) {
        return res.status(400).json({
          success: false,
          message: '权限类型错误'
        });
      }
      
      const success = await MenuService.setUserMenuPermission(
        parseInt(userId),
        parseInt(menuId),
        permissionType
      );
      
      if (!success) {
        return res.status(500).json({
          success: false,
          message: '设置权限失败'
        });
      }
      
      res.json({
        success: true,
        message: '权限设置成功'
      });
    } catch (error) {
      console.error('设置用户菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '设置权限失败'
      });
    }
  }

  // 移除用户菜单权限
  static async removeUserMenuPermission(req: Request, res: Response) {
    try {
      const { userId, menuId } = req.params;
      
      const success = await MenuService.removeUserMenuPermission(
        parseInt(userId),
        parseInt(menuId)
      );
      
      if (!success) {
        return res.status(404).json({
          success: false,
          message: '权限不存在或移除失败'
        });
      }
      
      res.json({
        success: true,
        message: '权限移除成功'
      });
    } catch (error) {
      console.error('移除用户菜单权限失败:', error);
      res.status(500).json({
        success: false,
        message: '移除权限失败'
      });
    }
  }
}