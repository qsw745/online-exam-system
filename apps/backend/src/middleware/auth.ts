// src/middlewares/auth.middleware.ts
import jwt from 'jsonwebtoken'
import { pool } from '../config/database.js'
import type { RowDataPacket } from 'mysql2/promise'
import type { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/** ===== 可选：给 Request 增加类型（不想加可删掉这段） ===== */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username: string
        email: string
        role?: string | null
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
 * - 校验 JWT，加载用户（不校验 status 字段）
 * - 解析 orgId（请求头 x-org-id → 否则取主组织）
 * - 计算是否为该 org 的 admin，并挂到 req.auth
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) {
      return res.status(401).json({ success: false, error: '访问令牌缺失' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number }

    // 取用户（兼容旧结构：不强依赖 status）
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role FROM users WHERE id=? LIMIT 1',
      [decoded.id]
    )
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: '用户不存在' })
    }
    const user = users[0] as any

    // 解析 orgId：优先请求头
    let orgId: number | null = null
    const orgHeader = req.headers['x-org-id']
    if (typeof orgHeader === 'string' && orgHeader.trim() !== '' && !Number.isNaN(Number(orgHeader))) {
      orgId = Number(orgHeader)
    } else {
      orgId = await getPrimaryOrgId(user.id)
    }

    // 是否为该组织 admin（无 orgId 时按 false）
    const isAdminInOrg = orgId ? await isUserAdminInOrg(user.id, orgId) : false

    // 挂到请求对象（供后续中间件/控制器使用）
    req.user = { id: user.id, username: user.username, email: user.email, role: user.role ?? null }
    req.auth = { userId: user.id, orgId, isAdminInOrg }

    next()
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: '无效的访问令牌' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: '访问令牌已过期' })
    }
    console.error('认证中间件错误:', error)
    return res.status(500).json({ success: false, error: '服务器内部错误' })
  }
}

/**
 * 可选认证：
 * - 不抛错，只要能解析到 user / org / admin 就挂上；否则置空
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      return next()
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: number }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, role FROM users WHERE id=? LIMIT 1',
      [decoded.id]
    )
    if (users.length === 0) {
      req.user = null
      req.auth = { userId: null, orgId: null, isAdminInOrg: false }
      return next()
    }

    const user = users[0] as any

    let orgId: number | null = null
    const orgHeader = req.headers['x-org-id']
    if (typeof orgHeader === 'string' && orgHeader.trim() !== '' && !Number.isNaN(Number(orgHeader))) {
      orgId = Number(orgHeader)
    } else {
      orgId = await getPrimaryOrgId(user.id)
    }

    const isAdminInOrg = orgId ? await isUserAdminInOrg(user.id, orgId) : false

    req.user = { id: user.id, username: user.username, email: user.email, role: user.role ?? null }
    req.auth = { userId: user.id, orgId, isAdminInOrg }
    next()
  } catch {
    req.user = null
    req.auth = { userId: null, orgId: null, isAdminInOrg: false }
    next()
  }
}

/**
 * 授权：
 * - 若当前用户是所在 org 的 admin，直接放行；
 * - 否则回退检查旧字段 users.role 是否命中 allowedRoles（过渡期兼容）
 */
export const requireRole = (roles: string[] | string) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: '未授权访问' })
    }

    // 新 RBAC：org admin 直通
    if (req.auth?.isAdminInOrg) {
      return next()
    }

    // 旧字段回退（兼容还在用 users.role 的接口）
    const userRole = req.user.role
    if (userRole && allowedRoles.includes(userRole)) {
      return next()
    }

    return res.status(403).json({ success: false, error: '权限不足' })
  }
}
