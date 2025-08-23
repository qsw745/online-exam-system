import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { RoleService } from '../services/role.service.js';

/**
 * 角色权限检查中间件
 * @param requiredRoles 需要的角色代码数组
 * @returns Express中间件函数
 */
export const requireRole = (requiredRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // 检查用户是否已认证
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: '用户未认证'
        });
      }

      const userId = req.user.id;

      // 检查用户是否拥有任一所需角色
      const hasRole = await RoleService.userHasAnyRole(userId, requiredRoles);

      if (!hasRole) {
        return res.status(403).json({
          success: false,
          message: '权限不足，需要以下角色之一：' + requiredRoles.join(', ')
        });
      }

      next();
    } catch (error) {
      console.error('角色权限检查失败:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
};

/**
 * 检查用户是否拥有指定角色
 * @param userId 用户ID
 * @param roleCode 角色代码
 * @returns 是否拥有角色
 */
export const checkUserRole = async (userId: number, roleCode: string): Promise<boolean> => {
  try {
    return await RoleService.userHasRole(userId, roleCode);
  } catch (error) {
    console.error('检查用户角色失败:', error);
    return false;
  }
};

/**
 * 检查用户是否拥有任一指定角色
 * @param userId 用户ID
 * @param roleCodes 角色代码数组
 * @returns 是否拥有任一角色
 */
export const checkUserAnyRole = async (userId: number, roleCodes: string[]): Promise<boolean> => {
  try {
    return await RoleService.userHasAnyRole(userId, roleCodes);
  } catch (error) {
    console.error('检查用户角色失败:', error);
    return false;
  }
};

/**
 * 超级管理员权限检查中间件
 */
export const requireSuperAdmin = requireRole(['super_admin']);

/**
 * 管理员权限检查中间件（包括超级管理员）
 */
export const requireAdmin = requireRole(['super_admin', 'admin']);

/**
 * 教师权限检查中间件（包括管理员）
 */
export const requireTeacher = requireRole(['super_admin', 'admin', 'teacher']);

/**
 * 学生权限检查中间件（所有角色）
 */
export const requireStudent = requireRole(['super_admin', 'admin', 'teacher', 'student']);