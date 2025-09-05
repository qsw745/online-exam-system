import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { AuthRequest } from '../../types/auth.js'
import { ROLE_IDS, ROLE_HIERARCHY } from '../../config/roles.js'

/** code/名称 到 id 的映射（可按你库里实际情况增补） */
const ROLE_CODE_TO_ID: Record<string, number> = {
  super_admin: ROLE_IDS.SUPER_ADMIN,
  superadmin: ROLE_IDS.SUPER_ADMIN,
  SUPER_ADMIN: ROLE_IDS.SUPER_ADMIN,

  admin: ROLE_IDS.ADMIN,
  ADMIN: ROLE_IDS.ADMIN,

  teacher: ROLE_IDS.TEACHER,
  TEACHER: ROLE_IDS.TEACHER,

  student: ROLE_IDS.STUDENT,
  STUDENT: ROLE_IDS.STUDENT,
}

/** 对外导出：给调试中间件使用 */
export function extractUserRoleIds(user: any): number[] {
  const ids = new Set<number>()
  if (!user) return []

  // 1) 显式 ID 数组
  const rawIds: unknown = user.role_ids ?? user.roleIds ?? user.roles_ids ?? user.rolesIds
  if (Array.isArray(rawIds)) {
    for (const v of rawIds) {
      const n = typeof v === 'string' ? parseInt(v, 10) : v
      if (Number.isFinite(n)) ids.add(n as number)
    }
  }

  // 2) 单个 ID
  const singleId = Number(user.role_id ?? user.roleId)
  if (Number.isFinite(singleId)) ids.add(singleId)

  // 3) code 数组
  const rawCodes: unknown = user.role_codes ?? user.roleCodes ?? user.roles_codes ?? user.rolesCodes
  if (Array.isArray(rawCodes)) {
    for (const c of rawCodes) {
      const key = String(c || '').trim()
      const id = ROLE_CODE_TO_ID[key] ?? ROLE_CODE_TO_ID[key.toLowerCase()]
      if (id) ids.add(id)
    }
  }

  // 4) 单个 code / 名称
  const oneCode = (user.role ?? user.roleName ?? user.role_code ?? user.roleCode) as string | undefined
  if (oneCode) {
    const key = oneCode.trim()
    const id = ROLE_CODE_TO_ID[key] ?? ROLE_CODE_TO_ID[key.toLowerCase()]
    if (id) ids.add(id)
  }

  // 5) roles: [{ id, code }]
  const rawRoles: unknown = user.roles
  if (Array.isArray(rawRoles)) {
    for (const r of rawRoles) {
      const id = Number((r as any).id)
      if (Number.isFinite(id)) ids.add(id)
      const code = String((r as any).code || (r as any).name || '').trim()
      const mapped = ROLE_CODE_TO_ID[code] ?? ROLE_CODE_TO_ID[code.toLowerCase()]
      if (mapped) ids.add(mapped)
    }
  }

  // 6) 常见布尔位
  if (user.is_super_admin || user.isSuperAdmin) ids.add(ROLE_IDS.SUPER_ADMIN)
  if (user.is_admin || user.isAdmin) ids.add(ROLE_IDS.ADMIN)

  return Array.from(ids)
}

/** 层级比较：level 越小，权限越高 */
function hasEnoughLevel(userRoleId: number, requiredIds: number[]): boolean {
  if (!requiredIds?.length) return false
  const userLevel = ROLE_HIERARCHY[userRoleId as keyof typeof ROLE_HIERARCHY]
  if (!userLevel) return false
  const threshold = Math.min(
    ...requiredIds.map(rid => ROLE_HIERARCHY[rid as keyof typeof ROLE_HIERARCHY]).filter(Boolean)
  )
  return userLevel <= threshold
}

/** 按“角色ID列表”鉴权（新写法） */
export function requireRoleByIds(allowedRoleIds: number[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user
    if (!user) {
      return res.status(401).json({ success: false, message: '未登录或令牌无效' })
    }
    const userRoleIds = extractUserRoleIds(user)

    if (userRoleIds.includes(ROLE_IDS.SUPER_ADMIN)) return next()
    if (userRoleIds.some(id => allowedRoleIds.includes(id))) return next()
    if (userRoleIds.some(id => hasEnoughLevel(id, allowedRoleIds))) return next()

    return res.status(403).json({ success: false, message: '权限不足，需要指定的角色权限' })
  }
}

/** 兼容旧用法：requireRole(['ADMIN', 3, 'teacher']) */
export function requireRole(allowed: Array<number | string>): RequestHandler {
  const ids = (allowed ?? [])
    .map(x => {
      if (typeof x === 'number') return x
      const k = String(x).trim()
      return ROLE_CODE_TO_ID[k] ?? ROLE_CODE_TO_ID[k.toLowerCase()]
    })
    .filter((n): n is number => Number.isFinite(n))
  return requireRoleByIds(ids)
}
