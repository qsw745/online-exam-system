// src/controllers/org-user.controller.ts
import type { Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../config/database.js'
import { LoggerService } from '../services/logger.service.js'
import type { AuthRequest } from '../types/auth.js'
import type { ApiResponse } from '../types/response.js'
// 放在文件顶部其他 import 下面
let cachedUserCols: Set<string> | null = null
async function getUserCols(): Promise<Set<string>> {
  if (cachedUserCols) return cachedUserCols
  const [cols] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM users`)
  cachedUserCols = new Set((cols as any[]).map(c => String(c.Field)))
  return cachedUserCols
}

function isTrue(v: any) {
  return v === '1' || v === 'true' || v === 1 || v === true
}

/** users 表（按你项目里已有字段自适应） */
interface IUser extends RowDataPacket {
  id: number
  username: string
  email?: string | null
  phone?: string | null
  real_name?: string | null
  is_active: 0 | 1
  created_at: Date
  updated_at: Date
}

/** 组织-用户 关联表 */
interface IUserOrg extends RowDataPacket {
  user_id: number
  org_id: number
  is_primary?: 0 | 1
  created_at?: Date
  updated_at?: Date
}

/** 组织表（仅用于检测/递归） */
interface IOrg extends RowDataPacket {
  id: number
  parent_id?: number | null
}

/** listUsers 返回体 */
type OrgUsersList = {
  items: Array<IUser & { role_codes: string[] }>
  total: number
  page: number
  limit: number
}

export const OrgUserController = {
  /**
   * PUT /orgs/:fromOrgId/users/:userId/move/:toOrgId
   * 语义：把 user 从 fromOrgId 移动到 toOrgId
   * 行为：确保 toOrgId 关联存在 -> 清空该用户所有 is_primary -> 把 toOrgId 置为主 -> 删除 fromOrgId 关联
   */
  async moveUser(req: AuthRequest, res: Response) {
    const fromOrgId = Number(req.params.fromOrgId)
    const toOrgId = Number(req.params.toOrgId)
    const userId = Number(req.params.userId)

    if (![fromOrgId, toOrgId, userId].every(Number.isFinite)) {
      return res.status(400).json({ success: false, error: '无效的参数' })
    }
    if (fromOrgId === toOrgId) {
      return res.status(400).json({ success: false, error: '源与目标机构相同' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 校验组织与用户存在
      const [[fo]] = await conn.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [fromOrgId])
      const [[to]] = await conn.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [toOrgId])
      const [[u]] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1', [userId])
      if (!fo || !to || !u) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '组织或用户不存在' })
      }

      // 确保目标关联存在（没有则插入）
      await conn.query(
        `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, created_at, updated_at)
         VALUES (?, ?, 0, NOW(), NOW())`,
        [userId, toOrgId]
      )

      // 清空该用户全部主组织标记
      await conn.query(`UPDATE user_organizations SET is_primary=0, updated_at=NOW() WHERE user_id=?`, [userId])

      // 目标设为主组织
      const [ret1] = await conn.query<ResultSetHeader>(
        `UPDATE user_organizations SET is_primary=1, updated_at=NOW() WHERE user_id=? AND org_id=?`,
        [userId, toOrgId]
      )
      if (ret1.affectedRows === 0) {
        await conn.rollback()
        return res.status(500).json({ success: false, error: '设置目标主组织失败' })
      }

      // 删除源组织关联
      await conn.query(`DELETE FROM user_organizations WHERE user_id=? AND org_id=?`, [userId, fromOrgId])

      await conn.commit()

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'move_user_org',
        resourceType: 'organization',
        resourceId: toOrgId,
        details: { user_id: userId, from_org_id: fromOrgId, to_org_id: toOrgId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { user_id: userId, from_org_id: fromOrgId, to_org_id: toOrgId } })
    } catch (e) {
      try {
        await conn.rollback()
      } catch {}
      console.error('移动用户部门错误:', e)
      return res.status(500).json({ success: false, error: '移动用户部门失败' })
    } finally {
      conn.release()
    }
  },

  /**
   * POST /orgs/users/:userId/orgs
   * body: { org_ids: number[], primary_org_id?: number }
   * 语义：给用户关联多个机构（不移除旧的）。若提供 primary_org_id，则设其为主组织。
   */
  async linkUserOrgs(req: AuthRequest, res: Response) {
    const userId = Number(req.params.userId)
    const orgIds: number[] = Array.isArray(req.body?.org_ids) ? req.body.org_ids.map(Number).filter(Boolean) : []
    const primaryOrgId = req.body?.primary_org_id ? Number(req.body.primary_org_id) : null

    if (!Number.isFinite(userId) || orgIds.length === 0) {
      return res.status(400).json({ success: false, error: '参数错误：userId 或 org_ids' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 校验用户存在
      const [[u]] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1', [userId])
      if (!u) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      // 只保留存在的组织
      const [orgRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM organizations WHERE id IN (${orgIds.map(() => '?').join(',')})`,
        orgIds
      )
      const validOrgIds = (orgRows as any[]).map(r => Number(r.id))
      if (validOrgIds.length === 0) {
        await conn.rollback()
        return res.status(400).json({ success: false, error: '提供的组织不存在' })
      }

      // 批量插入关联
      const values = validOrgIds.map(() => '(?,?,0,NOW(),NOW())').join(',')
      const params: any[] = []
      validOrgIds.forEach(oid => {
        params.push(userId, oid)
      })
      await conn.query(
        `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, created_at, updated_at)
         VALUES ${values}`,
        params
      )

      // 可选：设置主组织
      if (primaryOrgId && validOrgIds.includes(primaryOrgId)) {
        await conn.query(`UPDATE user_organizations SET is_primary=0, updated_at=NOW() WHERE user_id=?`, [userId])
        await conn.query(`UPDATE user_organizations SET is_primary=1, updated_at=NOW() WHERE user_id=? AND org_id=?`, [
          userId,
          primaryOrgId,
        ])
      }

      await conn.commit()

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'link_user_orgs',
        resourceType: 'organization',
        resourceId: primaryOrgId || 0,
        details: { user_id: userId, org_ids: validOrgIds, primary_org_id: primaryOrgId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res
        .status(201)
        .json({ success: true, data: { user_id: userId, org_ids: validOrgIds, primary_org_id: primaryOrgId } })
    } catch (e) {
      try {
        await conn.rollback()
      } catch {}
      console.error('关联多个部门错误:', e)
      return res.status(500).json({ success: false, error: '关联多个部门失败' })
    } finally {
      conn.release()
    }
  },

  /**
   * PUT /orgs/:orgId/users/:userId/primary
   * 把 userId 在 orgId 上标记为主组织：
   *  - 若 user_organizations 中不存在该关系，先插入（is_primary=0）
   *  - 将该用户其它组织的 is_primary 置 0，再把当前置 1
   */
  async setPrimary(req: AuthRequest, res: Response<ApiResponse<{ user_id: number; org_id: number }>>) {
    const orgId = Number(req.params.orgId)
    const userId = Number(req.params.userId)

    if (!Number.isFinite(orgId) || !Number.isFinite(userId)) {
      return res.status(400).json({ success: false, error: '无效的参数' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 1) 校验组织存在
      const [[org]] = await conn.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [orgId])
      if (!org) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '组织不存在' })
      }

      // 2) 校验用户存在
      const [[u]] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1', [userId])
      if (!u) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '用户不存在' })
      }

      // 3) 确保用户-组织关系存在（没有则插入一条，is_primary=0）
      await conn.query<ResultSetHeader>(
        `
        INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, created_at, updated_at)
        VALUES (?, ?, 0, NOW(), NOW())
        `,
        [userId, orgId]
      )

      // 4) 先清零该用户所有主组织标记
      await conn.query<ResultSetHeader>(
        `UPDATE user_organizations SET is_primary=0, updated_at=NOW() WHERE user_id=?`,
        [userId]
      )

      // 5) 把当前组织置为主组织
      const [ret] = await conn.query<ResultSetHeader>(
        `UPDATE user_organizations SET is_primary=1, updated_at=NOW() WHERE user_id=? AND org_id=?`,
        [userId, orgId]
      )
      if (ret.affectedRows === 0) {
        await conn.rollback()
        return res.status(400).json({ success: false, error: '设置主组织失败' })
      }

      await conn.commit()

      // 记录日志（可选）
      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'set_primary_org',
        resourceType: 'organization',
        resourceId: orgId,
        details: { user_id: userId, org_id: orgId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { user_id: userId, org_id: orgId } })
    } catch (error) {
      console.error('设置主组织错误:', error)
      try {
        await conn.rollback()
      } catch {}
      return res.status(500).json({ success: false, error: '设置主组织失败' })
    } finally {
      conn.release()
    }
  },

  /**
   * GET /orgs/:orgId/users
   * ?page? &limit? &search? &role? &include_children?
   * - search 同时在 username/real_name/email/phone 模糊
   * - role 为 roles.code（如 'admin'），按用户在该机构（及可选子机构）的角色过滤
   */
  // 替换原来的 listUsers
  async listUsers(
    req: AuthRequest,
    res: Response<
      ApiResponse<{
        items: Array<{
          id: number
          username: string
          email?: string | null
          real_name?: string | null
          phone?: string | null
          is_active: 0 | 1
          created_at: Date
          updated_at: Date
          role_codes: string[]
        }>
        total: number
        page: number
        limit: number
      }>
    >
  ) {
    try {
      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.status(400).json({ success: false, error: '无效的组织ID' })

      const page = Number(req.query.page ?? 1) || 1
      const limit = Math.min(100, Number(req.query.limit ?? 10) || 10)
      const offset = (page - 1) * limit
      const search = (req.query.search as string | undefined)?.trim()
      const role = (req.query.role as string | undefined)?.trim()
      const includeChildren = isTrue(req.query.include_children)

      // 组织存在性
      const [[orgExists]] = await pool.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [
        orgId,
      ])
      if (!orgExists) return res.status(404).json({ success: false, error: '组织不存在' })

      // 递归取 orgId 集合
      let orgFilterSQL = 'uo.org_id = ?'
      const orgIds: number[] = [orgId]
      if (includeChildren) {
        const [ids] = await pool.query<RowDataPacket[]>(
          `
        WITH RECURSIVE org_cte AS (
          SELECT id, parent_id FROM organizations WHERE id = ?
          UNION ALL
          SELECT o.id, o.parent_id FROM organizations o
          INNER JOIN org_cte c ON o.parent_id = c.id
        )
        SELECT id FROM org_cte
        `,
          [orgId]
        )
        const arr = (ids as any[]).map(r => Number(r.id)).filter(Boolean)
        if (arr.length === 0) return res.json({ success: true, data: { items: [], total: 0, page, limit } })
        orgFilterSQL = `uo.org_id IN (${arr.map(() => '?').join(',')})`
        orgIds.length = 0
        orgIds.push(...arr)
      }

      // 动态探测 users 列
      const cols = await getUserCols()
      const hasEmail = cols.has('email')
      const hasRealName = cols.has('real_name')
      const hasPhone = cols.has('phone')
      const hasIsActive = cols.has('is_active')
      const hasCreatedAt = cols.has('created_at')
      const hasUpdatedAt = cols.has('updated_at')
      const hasStatus = cols.has('status')

      // 只选择存在的列
      const selectCols: string[] = ['u.id', 'u.username']
      if (hasEmail) selectCols.push('u.email')
      if (hasRealName) selectCols.push('u.real_name')
      if (hasPhone) selectCols.push('u.phone')
      if (hasIsActive) selectCols.push('u.is_active')
      if (hasCreatedAt) selectCols.push('u.created_at')
      if (hasUpdatedAt) selectCols.push('u.updated_at')
      if (hasStatus) selectCols.push('u.status')

      // where 构建
      const whereParts: string[] = [orgFilterSQL]
      const whereVals: any[] = [...orgIds]

      if (search) {
        const searchCols = ['username']
        if (hasRealName) searchCols.push('real_name')
        if (hasEmail) searchCols.push('email')
        if (hasPhone) searchCols.push('phone')

        whereParts.push('(' + searchCols.map(c => `u.${c} LIKE ?`).join(' OR ') + ')')
        const like = `%${search}%`
        for (let i = 0; i < searchCols.length; i++) whereVals.push(like)
      }

      if (role) {
        whereParts.push(`
        EXISTS (
          SELECT 1 FROM user_org_roles uor
          JOIN roles r ON r.id = uor.role_id
          WHERE uor.user_id = u.id
            AND uor.org_id IN (${orgIds.map(() => '?').join(',')})
            AND r.code = ?
        )
      `)
        whereVals.push(...orgIds, role)
      }

      const whereSQL = `WHERE ${whereParts.join(' AND ')}`

      // 统计
      const [[cnt]] = await pool.query<RowDataPacket[]>(
        `
      SELECT COUNT(DISTINCT u.id) AS total
      FROM users u
      JOIN user_organizations uo ON uo.user_id = u.id
      ${whereSQL}
      `,
        whereVals
      )
      const total = Number((cnt as any)?.total) || 0
      if (total === 0) {
        return res.json({ success: true, data: { items: [], total: 0, page, limit } })
      }

      // 查询
      const [rows] = await pool.query<RowDataPacket[]>(
        `
  SELECT
    ${selectCols.join(', ')},
    ANY_VALUE(uo.org_id)              AS org_id,
    ANY_VALUE(o.name)                 AS org_name,
    IFNULL(GROUP_CONCAT(DISTINCT r.code ORDER BY r.code SEPARATOR ','), '') AS role_codes
  FROM users u
  JOIN user_organizations uo ON uo.user_id = u.id
  LEFT JOIN organizations o   ON o.id = uo.org_id
  LEFT JOIN user_org_roles uor ON uor.user_id = u.id AND uor.org_id = uo.org_id
  LEFT JOIN roles r ON r.id = uor.role_id
  ${whereSQL}
  GROUP BY u.id
  ORDER BY u.id ASC
  LIMIT ? OFFSET ?
  `,
        [...whereVals, limit, offset]
      )

      const items = (rows as any[]).map(r => {
        const st: 'active' | 'disabled' =
          typeof r.status === 'string'
            ? r.status === 'disabled'
              ? 'disabled'
              : 'active'
            : hasIsActive
            ? Number(r.is_active) === 1
              ? 'active'
              : 'disabled'
            : 'active'
        const base: any = {
          id: r.id,
          username: r.username,
          // 如果没有 is_active 列，就给个安全默认值 1
          is_active: hasIsActive ? r.is_active : 1,
          status: st, // ← 新增，前端就可以直接用 status
          role_codes: (String(r.role_codes || '').trim() ? String(r.role_codes).split(',') : []) as string[],
          // 🟢 补上部门信息（关键修复）
          org_id: r.org_id ?? null,
          org_name: r.org_name ?? null,
        }
        if (hasEmail) base.email = r.email
        if (hasRealName) base.real_name = r.real_name
        if (hasPhone) base.phone = r.phone
        if (hasCreatedAt) base.created_at = r.created_at
        if (hasUpdatedAt) base.updated_at = r.updated_at
        return base
      })

      return res.json({ success: true, data: { items, total, page, limit } })
    } catch (error) {
      console.error('获取机构用户列表错误:', error)
      return res.status(500).json({ success: false, error: '获取机构用户列表失败' })
    }
  },

  /**
   * POST /orgs/:orgId/users
   * body: { user_ids: number[] }
   * - 批量添加（忽略已存在）
   * - 默认 is_primary=0
   */
  async addUsers(req: AuthRequest, res: Response<ApiResponse<{ added: number }>>) {
    try {
      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.status(400).json({ success: false, error: '无效的组织ID' })

      const userIds: number[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Boolean) : []
      if (userIds.length === 0) {
        return res.status(400).json({ success: false, error: 'user_ids 不能为空' })
      }

      // 组织存在性
      const [[orgExists]] = await pool.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [
        orgId,
      ])
      if (!orgExists) return res.status(404).json({ success: false, error: '组织不存在' })

      // 仅保留存在的用户
      const [validUsers] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      )
      const validIds = (validUsers as any[]).map(r => Number(r.id))
      if (validIds.length === 0) {
        return res.status(400).json({ success: false, error: '提供的用户不存在' })
      }

      // 批量插入，要求 user_organizations 上有 UNIQUE(user_id, org_id)
      const valuesSql = validIds.map(() => '(?,?,0,NOW(),NOW())').join(',')
      const params: any[] = []
      validIds.forEach(uid => params.push(uid, orgId))

      const [ret] = await pool.query<ResultSetHeader>(
        `
        INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, created_at, updated_at)
        VALUES ${valuesSql}
        `,
        params
      )

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'add_users_to_org',
        resourceType: 'organization',
        resourceId: orgId,
        details: { count: ret.affectedRows, user_ids: validIds },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.status(201).json({ success: true, data: { added: ret.affectedRows } })
    } catch (error) {
      console.error('批量添加机构用户错误:', error)
      return res.status(500).json({ success: false, error: '批量添加机构用户失败' })
    }
  },

  /**
   * DELETE /orgs/:orgId/users/:userId
   * - 若该关联为主组织 is_primary=1，则禁止删除（避免孤儿主组织）
   */
  async removeUser(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const orgId = Number(req.params.orgId)
      const userId = Number(req.params.userId)
      if (!Number.isFinite(orgId) || !Number.isFinite(userId)) {
        return res.status(400).json({ success: false, error: '无效的参数' })
      }

      const [[rel]] = await pool.query<IUserOrg[]>(
        `SELECT user_id, org_id, IFNULL(is_primary,0) AS is_primary
         FROM user_organizations
         WHERE org_id=? AND user_id=? LIMIT 1`,
        [orgId, userId]
      )
      if (!rel) return res.status(404).json({ success: false, error: '该用户不在此组织下' })

      if ((rel as any).is_primary === 1) {
        return res.status(400).json({ success: false, error: '不能移除用户的主组织，请先变更其主组织' })
      }

      const [ret] = await pool.query<ResultSetHeader>(`DELETE FROM user_organizations WHERE org_id=? AND user_id=?`, [
        orgId,
        userId,
      ])
      if (ret.affectedRows === 0) {
        return res.status(500).json({ success: false, error: '移除失败' })
      }

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'remove_user_from_org',
        resourceType: 'organization',
        resourceId: orgId,
        details: { user_id: userId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { message: '移除成功' } })
    } catch (error) {
      console.error('移除机构用户错误:', error)
      return res.status(500).json({ success: false, error: '移除机构用户失败' })
    }
  },
}

export default OrgUserController
