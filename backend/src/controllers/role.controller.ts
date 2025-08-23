import { Request, Response } from 'express';
import { RoleService } from '../services/role.service.js';
import { CreateRoleRequest, UpdateRoleRequest } from '../models/menu.model.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * 获取所有角色
 */
export const getAllRoles = async (req: Request, res: Response) => {
  try {
    const roles = await RoleService.getAllRoles();
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
};

/**
 * 根据ID获取角色
 */
export const getRoleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const role = await RoleService.getRoleById(parseInt(id));
    
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
};

/**
 * 创建角色
 */
export const createRole = async (req: AuthRequest, res: Response) => {
  try {
    const roleData: CreateRoleRequest = req.body;
    const role = await RoleService.createRole(roleData);
    
    res.status(201).json({
      success: true,
      data: role,
      message: '角色创建成功'
    });
  } catch (error) {
    console.error('创建角色失败:', error);
    res.status(500).json({
      success: false,
      message: '创建角色失败'
    });
  }
};

/**
 * 更新角色
 */
export const updateRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const roleData: UpdateRoleRequest = req.body;
    
    const role = await RoleService.updateRole(parseInt(id), roleData);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: '角色不存在'
      });
    }
    
    res.json({
      success: true,
      data: role,
      message: '角色更新成功'
    });
  } catch (error) {
    console.error('更新角色失败:', error);
    res.status(500).json({
      success: false,
      message: '更新角色失败'
    });
  }
};

/**
 * 删除角色
 */
export const deleteRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await RoleService.deleteRole(parseInt(id));
    
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
};

/**
 * 获取角色的菜单权限
 */
export const getRoleMenus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const menus = await RoleService.getRoleMenus(parseInt(id));
    
    res.json({
      success: true,
      data: menus
    });
  } catch (error) {
    console.error('获取角色菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '获取角色菜单权限失败'
    });
  }
};

/**
 * 设置角色的菜单权限
 */
export const setRoleMenus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { menuIds }: { menuIds: number[] } = req.body;
    
    await RoleService.setRoleMenus(parseInt(id), menuIds);
    
    res.json({
      success: true,
      message: '角色菜单权限设置成功'
    });
  } catch (error) {
    console.error('设置角色菜单权限失败:', error);
    res.status(500).json({
      success: false,
      message: '设置角色菜单权限失败'
    });
  }
};

/**
 * 获取用户的角色
 */
export const getUserRoles = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const roles = await RoleService.getUserRoles(parseInt(userId));
    
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
};

/**
 * 设置用户的角色
 */
export const setUserRoles = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { roleIds }: { roleIds: number[] } = req.body;
    
    await RoleService.setUserRoles(parseInt(userId), roleIds);
    
    res.json({
      success: true,
      message: '用户角色设置成功'
    });
  } catch (error) {
    console.error('设置用户角色失败:', error);
    res.status(500).json({
      success: false,
      message: '设置用户角色失败'
    });
  }
};