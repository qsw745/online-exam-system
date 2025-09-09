import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { pool } from '@config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import { resolveOrgId } from './auth.js'
import { ROLE_IDS } from '@config/roles.js'

function extractRoleIdsFromReq(req: Request): number[] {
  const u: any = (req as any).user || {}
  const ids = new Set<number>()
  const push = (v: any) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : v
    if (Number.isFinite(n)) ids.add(n)
  }

  if (Array.isArray(u.role_ids)) u.role_ids.forEach(push)
  if (Array.isArray(u.roles)) u.roles.forEach((r: any) => push(r?.id))
  const single = Number(u.role_id ?? u.roleId)
  if (Number.isFinite(single)) ids.add(single)

  if (u.is_super_admin || u.isSuperAdmin) ids.add(ROLE_IDS.SUPER_ADMIN)
  if (u.is_admin || u.isAdmin) ids.add(ROLE_IDS.ADMIN)
  return Array.from(ids)
}

async function userHasMenu(req: Request, userId: number, menuCode: string): Promise<boolean> {
  const orgId = await resolveOrgId(req, userId)
  const params: any[] = [userId]
  const orgFilter = orgId ? 'AND uor.org_id = ?' : ''
  if (orgId) params.push(orgId)
  params.push(menuCode)

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1
       FROM user_org_roles uor
       JOIN role_menus rm ON rm.role_id = uor.role_id
       JOIN menus m ON m.id = rm.menu_id
      WHERE uor.user_id = ?
        ${orgFilter}
        AND m.code = ?
      LIMIT 1`,
    params
  )
  return rows.length > 0
}

/** 允许 super_admin / admin 或拥有指定菜单 code 的用户通过 */
export function requireAdminOrMenu(menuCode: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u: any = (req as any).user
    if (!u?.id) return res.status(401).json({ success: false, message: '请先登录' })

    const roleIds = extractRoleIdsFromReq(req)
    if (roleIds.includes(ROLE_IDS.SUPER_ADMIN) || roleIds.includes(ROLE_IDS.ADMIN)) return next()
    if (await userHasMenu(req, u.id, menuCode)) return next()
    if ((req as any).auth?.isAdminInOrg) return next()
    ;((req as any).log ?? console).warn?.(
      {
        rid: (req as any).id ?? null,
        method: req.method,
        url: req.originalUrl || req.url,
        userId: u.id,
        roleIds,
        required: ['ADMIN/SUPER_ADMIN', `menu:${menuCode}`],
      },
      '[RBAC] forbidden'
    )
    return res.status(403).json({ success: false, message: '权限不足，需要指定的角色权限' })
  }
}
