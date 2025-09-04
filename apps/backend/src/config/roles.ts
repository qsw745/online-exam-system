// 角色ID常量定义
// 注意：这些ID需要与数据库中的实际角色ID保持一致

export const ROLE_IDS = {
  SUPER_ADMIN: 1,  // 超级管理员
  ADMIN: 2,        // 管理员
  TEACHER: 3,      // 教师
  STUDENT: 4       // 学生
} as const;

// 角色名称映射
export const ROLE_NAMES = {
  [ROLE_IDS.SUPER_ADMIN]: '超级管理员',
  [ROLE_IDS.ADMIN]: '管理员',
  [ROLE_IDS.TEACHER]: '教师',
  [ROLE_IDS.STUDENT]: '学生'
} as const;

// 角色层级定义（数字越小权限越高）
export const ROLE_HIERARCHY = {
  [ROLE_IDS.SUPER_ADMIN]: 1,
  [ROLE_IDS.ADMIN]: 2,
  [ROLE_IDS.TEACHER]: 3,
  [ROLE_IDS.STUDENT]: 4
} as const;

/**
 * 检查角色是否有足够权限
 * @param userRoleId 用户角色ID
 * @param requiredRoleId 需要的角色ID
 * @returns 是否有权限
 */
export function hasRolePermission(userRoleId: number, requiredRoleId: number): boolean {
  const userLevel = ROLE_HIERARCHY[userRoleId as keyof typeof ROLE_HIERARCHY];
  const requiredLevel = ROLE_HIERARCHY[requiredRoleId as keyof typeof ROLE_HIERARCHY];
  
  if (!userLevel || !requiredLevel) {
    return false;
  }
  
  return userLevel <= requiredLevel;
}