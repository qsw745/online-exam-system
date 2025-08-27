// apps/backend/src/middleware/roleAuth.ts
import type { NextFunction, Request, Response } from 'express'
import { ROLE_IDS } from '../constants/roles.js'
import { RoleService } from '../services/role.service.js'

/**
 * 角色ID检查中间件工厂（按数值ID判断）
 * 使用方式：
 *   router.get('/xxx', authenticateToken, requireRoleByIds([ROLE_IDS.ADMIN]), handler)
 */
export const requireRoleByIds = (requiredRoleIds: number[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user
      const userId: number | undefined = user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: '用户未认证' })
      }

      const hasRole = await RoleService.userHasAnyRole(userId, requiredRoleIds)
      if (!hasRole) {
        return res.status(403).json({ success: false, message: '权限不足，需要指定的角色权限' })
      }

      return next()
    } catch (error) {
      console.error('角色权限检查失败:', error)
      return res.status(500).json({ success: false, message: '权限检查失败' })
    }
  }
}

/** 为了兼容旧用法：导出别名 requireRole（与 requireRoleByIds 等价） */
export const requireRole = requireRoleByIds

/** 单角色检查（工具函数，可选） */
export const checkUserRole = async (userId: number, roleId: number): Promise<boolean> => {
  try {
    return await RoleService.userHasRole(userId, roleId)
  } catch (error) {
    console.error('检查用户角色失败:', error)
    return false
  }
}

/** 任一角色检查（工具函数，可选） */
export const checkUserAnyRole = async (userId: number, roleIds: number[]): Promise<boolean> => {
  try {
    return await RoleService.userHasAnyRole(userId, roleIds)
  } catch (error) {
    console.error('检查用户角色失败:', error)
    return false
  }
}

/** 预置中间件（按ID集合） */
export const requireSuperAdmin = requireRoleByIds([ROLE_IDS.SUPER_ADMIN])
export const requireAdmin = requireRoleByIds([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN])
export const requireTeacher = requireRoleByIds([ROLE_IDS.SUPER_ADMIN, ROLE_IDS.ADMIN, ROLE_IDS.TEACHER])
export const requireStudent = requireRoleByIds([
  ROLE_IDS.SUPER_ADMIN,
  ROLE_IDS.ADMIN,
  ROLE_IDS.TEACHER,
  ROLE_IDS.STUDENT,
])
