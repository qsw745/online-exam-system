/* eslint-disable @typescript-eslint/no-explicit-any */
// 让没有 @types/node 也能编译
declare const process: any

import { pool } from '@/config/database'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import * as jwt from 'jsonwebtoken'
import type { RowDataPacket } from 'mysql2/promise'

const getJwtSecret = () => (process?.env?.JWT_SECRET as string) || 'dev-secret'

async function getPrimaryOrgId(userId: number): Promise<number | null> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT org_id FROM user_organizations WHERE user_id=? ORDER BY is_primary DESC LIMIT 1`,
    [userId]
  )
  return (row as any)?.org_id ?? null
}

export async function resolveOrgId(req: Request, userId: number): Promise<number | null> {
  const p = (req.params as any)?.orgId
  if (p != null && String(p).trim() !== '' && !Number.isNaN(Number(p))) return Number(p)
  const hdr = req.get('x-org-id')
  if (hdr && hdr.trim() !== '' && !Number.isNaN(Number(hdr))) return Number(hdr)
  return getPrimaryOrgId(userId)
}

async function isUserAdminInOrg(userId: number, orgId: number): Promise<boolean> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT 1
       FROM user_org_roles uor
       JOIN roles r ON r.id = uor.role_id
      WHERE uor.user_id=? AND uor.org_id=? AND r.code='admin' AND r.is_disabled=0
      LIMIT 1`,
    [userId, orgId]
  )
  return !!row
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username?: string
        email?: string
        role?: string | null
        role_ids?: number[]
        roles?: Array<{ id: number; code: string }>
        is_admin?: boolean
        is_super_admin?: boolean
        isAdmin?: boolean
        isSuperAdmin?: boolean
      } | null
      auth?: { userId: number | null; orgId: number | null; isAdminInOrg: boolean }
    }
  }
}

/** 可选认证：有 token 就验证；无 token 当匿名 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    const authz = req.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : authz.split(' ')[1]
    if (!token) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      return next()
    }

    const payload: any = jwt.verify(token, getJwtSecret())
    const uid = Number(payload?.id)
    if (!Number.isFinite(uid) || uid <= 0) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      return next()
    }

    const [rows] = await pool.query<RowDataPacket[]>(`SELECT id, username, email, role FROM users WHERE id=? LIMIT 1`, [
      uid,
    ])
    if (rows.length === 0) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      return next()
    }

    const u = rows[0] as any
    const tokenRoles = Array.isArray(payload?.roles)
      ? payload.roles.map((r: any) => ({ id: Number(r?.id), code: String(r?.code || '').toLowerCase() }))
      : []
    const tokenRoleIds = Array.isArray(payload?.role_ids)
      ? payload.role_ids.map((n: any) => Number(n)).filter(Number.isFinite)
      : []

    const hasAdminCode = tokenRoles.some(
      (r: any) => r.code === 'admin' || r.code === 'super_admin' || r.code === 'superadmin'
    )
    const hasAdminId = tokenRoleIds.includes(1) || tokenRoleIds.includes(2)

    req.user = {
      id: u.id,
      username: u.username,
      email: u.email,
      role: (u.role as any) ?? (hasAdminCode || hasAdminId ? 'admin' : null),
      role_ids: tokenRoleIds.length ? tokenRoleIds : undefined,
      roles: tokenRoles.length ? tokenRoles : undefined,
      is_admin: hasAdminCode || hasAdminId || undefined,
      is_super_admin: tokenRoleIds.includes(1) || undefined,
      isAdmin: hasAdminCode || hasAdminId || undefined,
      isSuperAdmin: tokenRoleIds.includes(1) || undefined,
    }

    const orgId = await resolveOrgId(req, u.id)
    const isAdmin = orgId ? await isUserAdminInOrg(u.id, orgId) : false
    req.auth = { userId: u.id, orgId, isAdminInOrg: isAdmin }

    next()
  } catch {
    req.user = null
    req.auth = { userId: null, orgId: null, isAdminInOrg: false }
    next()
  }
}

/** 强制认证 */
export const authenticateToken: RequestHandler = async (req, res, next) => {
  const authz = req.get('authorization') || ''
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : authz.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, error: '访问令牌缺失' })
  try {
    jwt.verify(token, getJwtSecret(), { clockTolerance: 30 } as any)
    next()
  } catch (e: any) {
    if (e?.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: '访问令牌已过期' })
    }
    return res.status(401).json({ success: false, error: '无效的访问令牌' })
  }
}

/** 允许 admin/super_admin 或指定角色 code */
export function requireRole(allowed: string[] = []): RequestHandler {
  const allow = new Set(allowed.map(s => String(s || '').toLowerCase()))
  return (req: Request, res: Response, next: NextFunction) => {
    const u: any = (req as any).user
    if (!u?.id) return res.status(401).json({ success: false, message: '请先登录' })

    const isGlobalAdmin = !!(u.is_admin || u.isAdmin || u.is_super_admin || u.isSuperAdmin)
    const hasAdminCode =
      Array.isArray(u.roles) &&
      u.roles.some((r: any) => ['admin', 'super_admin', 'superadmin'].includes(String(r?.code || '').toLowerCase()))
    if (isGlobalAdmin || hasAdminCode) return next()

    const codes = new Set<string>()
    if (u.role) codes.add(String(u.role).toLowerCase())
    if (Array.isArray(u.roles)) u.roles.forEach((r: any) => r?.code && codes.add(String(r.code).toLowerCase()))
    const hit = Array.from(codes).some(c => allow.has(c))
    if (hit) return next()

    return res.status(403).json({ success: false, message: '权限不足，需要指定的角色权限' })
  }
}

/** 允许 admin/super_admin 或命中任意一个 roleId */
export function requireRoleByIds(roleIds: number[] = []): RequestHandler {
  const ids = new Set<number>(roleIds.filter(n => Number.isFinite(n)))
  return (req: Request, res: Response, next: NextFunction) => {
    const u: any = (req as any).user
    if (!u?.id) return res.status(401).json({ success: false, message: '请先登录' })

    const isGlobalAdmin = !!(u.is_admin || u.isAdmin || u.is_super_admin || u.isSuperAdmin)
    if (isGlobalAdmin) return next()

    const userIds = new Set<number>((u.role_ids as number[] | undefined) || [])
    const hit = Array.from(ids).some(id => userIds.has(id))
    if (hit) return next()

    return res.status(403).json({ success: false, message: '权限不足，需要指定的角色 ID' })
  }
}
