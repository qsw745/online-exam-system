// apps/backend/src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { ApiResponse } from '../types/response.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username: string
        email: string
        role?: 'student' | 'teacher' | 'admin' | null
      } | null
      auth?: {
        userId: number | null
        orgId: number | null
        isAdminInOrg: boolean
      }
    }
  }
}

/** 根据 userId 取主组织 */
async function getPrimaryOrgId(userId: number): Promise<number | null> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT org_id
       FROM user_organizations
      WHERE user_id=?
      ORDER BY is_primary DESC
      LIMIT 1`,
    [userId]
  )
  return (row as any)?.org_id ?? null
}

/** 判断用户在 org 是否 admin（基于 user_org_roles + roles.code='admin'） */
async function isUserAdminInOrg(userId: number, orgId: number): Promise<boolean> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT 1
       FROM user_org_roles uor
       JOIN roles r ON r.id = uor.role_id
      WHERE uor.user_id = ?
        AND uor.org_id  = ?
        AND r.code='admin'
        AND r.is_disabled = 0
      LIMIT 1`,
    [userId, orgId]
  )
  return !!row
}

/** 解析当前请求要使用的 orgId：优先 URL :orgId → header x-org-id → 用户主组织 */
async function resolveOrgId(req: Request, userId: number): Promise<number | null> {
  const paramVal = (req.params as any)?.orgId
  if (paramVal != null && paramVal !== '' && !Number.isNaN(Number(paramVal))) {
    return Number(paramVal)
  }
  const hdr = req.header('x-org-id')
  if (hdr && hdr.trim() !== '' && !Number.isNaN(Number(hdr))) {
    return Number(hdr)
  }
  return getPrimaryOrgId(userId)
}

/**
 * 认证：
 * - 校验 JWT，加载 DB 用户（以数据库为准）
 * - 解析 orgId（URL :orgId → 头 x-org-id → 主组织）
 * - 计算是否为该 org 的 admin，并挂到 req.auth
 */
export const authenticateToken = async (
  req: Request,
  res: Response<ApiResponse<null> | any>,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) {
      res.status(401).json({ success: false, error: '访问令牌缺失' })
      return
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number }
    if (!decoded?.id || Number.isNaN(decoded.id) || decoded.id <= 0) {
      res.status(401).json({ success: false, error: '无效的访问令牌' })
      return
    }

    // 以数据库为准拿用户信息
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role FROM users WHERE id=? LIMIT 1',
      [decoded.id]
    )
    if (users.length === 0) {
      res.status(401).json({ success: false, error: '用户不存在' })
      return
    }
    const u = users[0] as any

    const orgId = await resolveOrgId(req, u.id)
    const adminFlag = orgId ? await isUserAdminInOrg(u.id, orgId) : false

    req.user = { id: u.id, username: u.username, email: u.email, role: (u.role as any) ?? null }
    req.auth = { userId: u.id, orgId, isAdminInOrg: adminFlag }

    next()
  } catch (error: any) {
    if (error?.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, error: '无效的访问令牌' })
      return
    }
    if (error?.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, error: '访问令牌已过期' })
      return
    }
    console.error('authenticateToken error:', error)
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
}

/**
 * 可选认证：有 token 则解析，无 token 不报错
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      next()
      return
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number }
    if (!decoded?.id) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      next()
      return
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role FROM users WHERE id=? LIMIT 1',
      [decoded.id]
    )
    if (users.length === 0) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      next()
      return
    }

    const u = users[0] as any
    const orgId = await resolveOrgId(req, u.id)
    const adminFlag = orgId ? await isUserAdminInOrg(u.id, orgId) : false

    req.user = { id: u.id, username: u.username, email: u.email, role: (u.role as any) ?? null }
    req.auth = { userId: u.id, orgId, isAdminInOrg: adminFlag }
    next()
  } catch {
    req.user = null
    req.auth = { userId: null, orgId: null, isAdminInOrg: false }
    next()
  }
}

/**
 * 授权守卫（支持全局/组织角色）：
 * - 若 users.role 在允许列表 → 放行（全局直通）
 * - 若当前 org 是 admin → 放行（组织直通）
 * - 否则到 user_org_roles/roles 检查是否在当前 org 拥有任一允许的 roles.code
 */
export const requireRole = (roles: Array<'student' | 'teacher' | 'admin'> | string[]) => {
  const allowed = roles as string[]

  return async (req: Request, res: Response<ApiResponse<null>>, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ success: false, error: '请先登录' })
        return
      }

      const uid = req.user.id
      const globalRole = req.user.role || null

      // 1) 全局角色直通
      if (globalRole && allowed.includes(globalRole)) {
        next()
        return
      }

      // 2) 组织 admin 直通
      if (req.auth?.isAdminInOrg) {
        next()
        return
      }

      // 3) 组织角色匹配（teacher/admin 等）
      const orgId = await resolveOrgId(req, uid)
      if (!orgId) {
        res.status(403).json({ success: false, error: '权限不足（缺少 orgId）' })
        return
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.code
           FROM user_org_roles uor
           JOIN roles r ON r.id=uor.role_id
          WHERE uor.user_id=? AND uor.org_id=? AND r.is_disabled=0`,
        [uid, orgId]
      )
      const codes = (rows as any[]).map(r => String(r.code))
      const ok = codes.some(c => allowed.includes(c))

      if (ok) {
        next()
        return
      }

      res.status(403).json({ success: false, error: '权限不足，需要指定的角色权限' })
    } catch (e) {
      console.error('requireRole error:', e)
      res.status(500).json({ success: false, error: '权限检查失败' })
    }
  }
}

/** 兼容导出：某些地方可能还在 import { auth } */
export const auth = authenticateToken
