// apps/backend/src/common/middleware/debug-roles.ts
import type { NextFunction, Request, Response } from 'express'

type AnyUser = {
  id?: number | string
  username?: string
  roles?: Array<{ id?: number; code?: string }>
  role_ids?: number[]
  roleIds?: number[]
  roles_ids?: number[]
  rolesIds?: number[]
  role_codes?: string[]
  roleCodes?: string[]
  roles_codes?: string[]
  rolesCodes?: string[]
  is_super_admin?: boolean
  isSuperAdmin?: boolean
}

const ROLE_CODE_TO_ID: Record<string, number> = {
  super_admin: 1,
  superadmin: 1,
  admin: 2,
  teacher: 3,
  student: 4,
}

function extractUserRoleIds(u: AnyUser | undefined | null): number[] {
  const ids = new Set<number>()
  if (!u) return []

  const rawIds: unknown = u.role_ids ?? u.roleIds ?? u.roles_ids ?? u.rolesIds
  if (Array.isArray(rawIds)) {
    for (const v of rawIds) {
      const n = typeof v === 'string' ? parseInt(v, 10) : v
      if (Number.isFinite(n)) ids.add(n as number)
    }
  }

  const rawCodes: unknown = u.role_codes ?? u.roleCodes ?? u.roles_codes ?? u.rolesCodes
  if (Array.isArray(rawCodes)) {
    for (const c of rawCodes) {
      const code = String(c || '').toLowerCase()
      const id = ROLE_CODE_TO_ID[code]
      if (id) ids.add(id)
    }
  }

  if (Array.isArray(u.roles)) {
    for (const r of u.roles) {
      const id = Number((r as any).id)
      if (Number.isFinite(id)) ids.add(id)
      const code = String((r as any).code || '').toLowerCase()
      const mapped = ROLE_CODE_TO_ID[code]
      if (mapped) ids.add(mapped)
    }
  }

  if ((u as any)?.is_super_admin || (u as any)?.isSuperAdmin) {
    ids.add(1)
  }
  return Array.from(ids)
}

// 只“解码”JWT payload（不验签）以便调试；失败时返回 undefined
function safeDecodeJwtPayload(token: string | undefined) {
  try {
    if (!token) return undefined
    const parts = token.split('.')
    if (parts.length !== 3) return undefined
    const payloadB64 = parts[1]
    const normalized = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const json = Buffer.from(normalized + '==='.slice((normalized.length + 3) % 4), 'base64').toString('utf8')
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

export function logUserRoles(req: Request & { id?: string }, _res: Response, next: NextFunction) {
  const rid = req.id || '-'
  const auth = (req.headers['authorization'] as string) || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const jwtPayload = safeDecodeJwtPayload(bearer)

  const user = (req as any).user as AnyUser | undefined
  const roleIds = extractUserRoleIds(user)

  const orgId = req.header('x-org-id') || req.query.orgId || '-'
  const referer = req.header('referer') || '-'
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '-'

  console.log(
    `[auth-debug][rid=${rid}] ${req.method} ${req.originalUrl}\n` +
      `  ip=${ip} referer=${referer}\n` +
      `  x-org-id=${orgId}\n` +
      `  authHeader=${auth ? 'present' : 'missing'} bearer.len=${bearer ? bearer.length : 0}\n` +
      `  jwt.payload=${jwtPayload ? JSON.stringify(jwtPayload) : 'N/A'}\n` +
      `  req.user=${user ? JSON.stringify({ id: user.id, username: user.username }) : 'undefined'}\n` +
      `  extracted roleIds=${JSON.stringify(roleIds)}`
  )

  // 给后续中间件留个调试对象
  ;(req as any).__authDebug = { rid, orgId, roleIds, jwtPayload }
  next()
}
