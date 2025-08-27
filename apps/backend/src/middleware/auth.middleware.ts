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
  return row?.org_id ?? null
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

/**
 * 认证：
 * - 校验 JWT，加载 DB 用户（不强依赖 status 字段）
 * - 解析 orgId（请求头 x-org-id → 否则取主组织）
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

    // 解析 orgId：优先请求头 x-org-id
    let orgId: number | null = null
    const orgHeader = req.headers['x-org-id']
    if (typeof orgHeader === 'string' && orgHeader.trim() !== '' && !Number.isNaN(Number(orgHeader))) {
      orgId = Number(orgHeader)
    } else {
      orgId = await getPrimaryOrgId(u.id)
    }

    const isAdminInOrg = orgId ? await isUserAdminInOrg(u.id, orgId) : false

    req.user = { id: u.id, username: u.username, email: u.email, role: (u.role as any) ?? null }
    req.auth = { userId: u.id, orgId, isAdminInOrg }

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
    console.error('认证中间件错误:', error)
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
}

/**
 * 可选认证：
 * - 有 token 就解析并注入 req.user/req.auth；无 token 不报错
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

    let orgId: number | null = null
    const orgHeader = req.headers['x-org-id']
    if (typeof orgHeader === 'string' && orgHeader.trim() !== '' && !Number.isNaN(Number(orgHeader))) {
      orgId = Number(orgHeader)
    } else {
      orgId = await getPrimaryOrgId(u.id)
    }

    const isAdminInOrg = orgId ? await isUserAdminInOrg(u.id, orgId) : false

    req.user = { id: u.id, username: u.username, email: u.email, role: (u.role as any) ?? null }
    req.auth = { userId: u.id, orgId, isAdminInOrg }
    next()
  } catch {
    req.user = null
    req.auth = { userId: null, orgId: null, isAdminInOrg: false }
    next()
  }
}

/**
 * 授权守卫：
 * - 若当前用户是所在 org 的 admin，直接放行；
 * - 否则回退检查旧字段 users.role 是否命中 allowedRoles（兼容过渡期）
 */
export const requireRole = (roles: Array<'student' | 'teacher' | 'admin'> | string[]) => {
  const allowed = roles as string[]
  return (req: Request, res: Response<ApiResponse<null>>, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '请先登录' })
      return
    }
    if (req.auth?.isAdminInOrg) {
      next()
      return
    }
    const role = req.user.role
    if (!role || !allowed.includes(role)) {
      res.status(403).json({ success: false, error: '权限不足' })
      return
    }
    next()
  }
}

/** 兼容导出：有些地方可能还在 import { auth } */
export const auth = authenticateToken
