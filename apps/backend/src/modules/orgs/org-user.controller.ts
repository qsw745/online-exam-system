// apps/backend/src/modules/orgs/org-user.controller.ts
import { pool } from '@config/database.js'
import type { Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import {LoggerService} from '@services/logger.service.js'

import type { AuthRequest } from '../../types/auth.js'
import type { ApiResponse } from '../../types/response.js'

// -------- 工具：统一记录操作日志（落到控制台/Winston，不改你DB日志服务） --------
async function logUserAction(payload: {
  userId: number
  username?: string
  action: string
  resourceType?: string
  resourceId?: number
  details?: unknown
  ipAddress?: string
  userAgent?: string
}) {
  try {
    LoggerService.info('user_action', JSON.stringify({ ...payload }))
  } catch {}
}

// -------- 动态探测：组织表名（organizations 或 orgs） --------
let cachedOrgTable: string | null = null
async function getOrgTable(): Promise<string> {
  if (cachedOrgTable) return cachedOrgTable
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
  )
  const names = new Set((rows as any[]).map(r => String(r.table_name).toLowerCase()))
  if (names.has('organizations')) cachedOrgTable = 'organizations'
  else if (names.has('orgs')) cachedOrgTable = 'orgs'
  else cachedOrgTable = 'organizations' // 兜底
  return cachedOrgTable
}

// -------- 动态探测：组织-用户关联表名和字段结构 --------
let cachedOrgUserTable: string | null = null
let cachedOrgUserColumns: Set<string> | null = null

async function getOrgUserTable(): Promise<string> {
  if (cachedOrgUserTable) return cachedOrgUserTable
  const candidates = ['user_organizations', 'org_users', 'user_org', 'org_user', 'user_orgs']
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
  )
  const names = new Set((rows as any[]).map(r => String(r.table_name).toLowerCase()))
  for (const t of candidates) {
    if (names.has(t)) {
      cachedOrgUserTable = t
      return t
    }
  }
  cachedOrgUserTable = 'user_organizations'
  return cachedOrgUserTable
}

async function getOrgUserColumns(): Promise<Set<string>> {
  if (cachedOrgUserColumns) return cachedOrgUserColumns
  const tableName = await getOrgUserTable()
  try {
    const [cols] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${tableName}`)
    cachedOrgUserColumns = new Set((cols as any[]).map(c => String(c.Field)))
  } catch {
    cachedOrgUserColumns = new Set(['user_id', 'org_id', 'organization_id', 'is_primary', 'created_at', 'updated_at'])
  }
  return cachedOrgUserColumns
}

// -------- 动态探测：users 表列 --------
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

export const OrgUserController = {
  // GET /orgs/:orgId/users
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
          is_active?: 0 | 1
          status?: 'active' | 'disabled'
          created_at?: Date
          updated_at?: Date
          org_id?: number | null
          org_name?: string | null
          role_codes: string[]
        }>
        total: number
        page: number
        limit: number
      }>
    >
  ) {
    try {
      const orgTable = await getOrgTable()
      const orgUserTable = await getOrgUserTable()
      const orgUserCols = await getOrgUserColumns()

      const orgId = Number((req.params as any)?.orgId ?? (req.query as any)?.orgId)
      if (!Number.isFinite(orgId)) {
        return res.status(400).json({ success: false, error: '无效的组织ID' })
      }

      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10))
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)))
      const offset = (page - 1) * limit
      const search = (req.query.search as string | undefined)?.trim()
      const role = (req.query.role as string | undefined)?.trim()
      const includeChildren = isTrue(req.query.include_children)

      // 动态确定组织ID字段名
      const orgIdField = orgUserCols.has('org_id')
        ? 'org_id'
        : orgUserCols.has('organization_id')
        ? 'organization_id'
        : 'org_id'

      // 组织存在？
      const [[orgExists]] = await pool.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [orgId])
      if (!orgExists) return res.status(404).json({ success: false, error: '组织不存在' })

      // 组织 id 列表（递归 or 单点）
      let orgIds: number[] = [orgId]
      if (includeChildren) {
        try {
          const [ids] = await pool.query<RowDataPacket[]>(
            `
            WITH RECURSIVE c AS (
              SELECT id FROM ${orgTable} WHERE id=?
              UNION ALL
              SELECT o.id FROM ${orgTable} o JOIN c ON o.parent_id = c.id
            ) SELECT id FROM c
          `,
            [orgId]
          )
          const arr = (ids as any[]).map(r => Number(r.id)).filter(Boolean)
          if (arr.length) orgIds = arr
        } catch {
          // MySQL < 8：忽略子机构
          orgIds = [orgId]
        }
      }

      // users 列检测
      const cols = await getUserCols()
      const hasEmail = cols.has('email')
      const hasRealName = cols.has('real_name')
      const hasPhone = cols.has('phone')
      const hasIsActive = cols.has('is_active')
      const hasStatus = cols.has('status')
      const hasCreatedAt = cols.has('created_at')
      const hasUpdatedAt = cols.has('updated_at')

      const selectCols: string[] = ['u.id', 'u.username']
      if (hasEmail) selectCols.push('u.email')
      if (hasRealName) selectCols.push('u.real_name')
      if (hasPhone) selectCols.push('u.phone')
      if (hasIsActive) selectCols.push('u.is_active')
      if (hasStatus) selectCols.push('u.status')
      if (hasCreatedAt) selectCols.push('u.created_at')
      if (hasUpdatedAt) selectCols.push('u.updated_at')

      // where 条件
      const whereParts: string[] = [`uo.${orgIdField} IN (${orgIds.map(() => '?').join(',')})`]
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

      // 角色筛选（存在 user_org_roles 表时）
      if (role) {
        try {
          const [tableCheck] = await pool.query<RowDataPacket[]>(
            `SELECT table_name FROM information_schema.tables 
             WHERE table_schema = DATABASE() AND table_name = 'user_org_roles'`
          )
          if (tableCheck.length > 0) {
            whereParts.push(
              `EXISTS (
                SELECT 1 FROM user_org_roles uor
                JOIN roles r ON r.id = uor.role_id
                WHERE uor.user_id = u.id
                  AND uor.${orgIdField.replace('uo.', '')} IN (${orgIds.map(() => '?').join(',')})
                  AND r.code = ?
              )`
            )
            whereVals.push(...orgIds, role)
          }
        } catch {}
      }

      const whereSQL = 'WHERE ' + whereParts.join(' AND ')

      // 统计
      const countSql = `
        SELECT COUNT(DISTINCT u.id) AS total
        FROM users u
        JOIN ${orgUserTable} uo ON uo.user_id = u.id
        ${whereSQL}
      `
      const [[cnt]] = await pool.query<RowDataPacket[]>(countSql, whereVals)
      const total = Number((cnt as any)?.total) || 0

      if (total === 0) {
        return res.json({ success: true, data: { items: [], total: 0, page, limit } })
      }

      // 数据查询
      const dataSql = `
        SELECT
          ${selectCols.join(', ')},
          uo.${orgIdField} AS org_id,
          o.name AS org_name
        FROM users u
        JOIN ${orgUserTable} uo ON uo.user_id = u.id
        LEFT JOIN ${orgTable} o ON o.id = uo.${orgIdField}
        ${whereSQL}
        ORDER BY u.id DESC
        LIMIT ? OFFSET ?
      `
      const [rows] = await pool.query<RowDataPacket[]>(dataSql, [...whereVals, limit, offset])

      const items = (rows as any[]).map(r => {
        // 统一 status
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
          role_codes: [], // 简化：不查具体角色列表
          status: st,
          org_id: r.org_id ?? null,
          org_name: r.org_name ?? null,
        }
        if (hasEmail) base.email = r.email
        if (hasRealName) base.real_name = r.real_name
        if (hasPhone) base.phone = r.phone
        if (hasIsActive) base.is_active = r.is_active
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

  // 批量把用户加入机构
  async addUsers(req: AuthRequest, res: Response<ApiResponse<{ added: number }>>) {
    try {
      const orgTable = await getOrgTable()
      const orgUserTable = await getOrgUserTable()
      const orgUserCols = await getOrgUserColumns()
      const orgIdField = orgUserCols.has('org_id')
        ? 'org_id'
        : orgUserCols.has('organization_id')
        ? 'organization_id'
        : 'org_id'

      const orgId = Number(req.params.orgId)
      if (!Number.isFinite(orgId)) return res.status(400).json({ success: false, error: '无效的组织ID' })

      const userIds: number[] = Array.isArray(req.body?.user_ids) ? req.body.user_ids.map(Number).filter(Boolean) : []
      if (userIds.length === 0) return res.status(400).json({ success: false, error: 'user_ids 不能为空' })

      const [[orgExists]] = await pool.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [orgId])
      if (!orgExists) return res.status(404).json({ success: false, error: '组织不存在' })

      const [validUsers] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
        userIds
      )
      const validIds = (validUsers as any[]).map(r => Number(r.id))
      if (validIds.length === 0) return res.status(400).json({ success: false, error: '提供的用户不存在' })

      // 动态构建插入字段
      const insertFields = ['user_id', orgIdField]
      const insertValues = ['?', '?']
      if (orgUserCols.has('is_primary')) {
        insertFields.push('is_primary')
        insertValues.push('0')
      }
      if (orgUserCols.has('created_at')) {
        insertFields.push('created_at')
        insertValues.push('NOW()')
      }
      if (orgUserCols.has('updated_at')) {
        insertFields.push('updated_at')
        insertValues.push('NOW()')
      }

      const valuesSql = validIds.map(() => `(${insertValues.join(',')})`).join(',')
      const params: any[] = []
      validIds.forEach(uid => params.push(uid, orgId))

      const [ret] = await pool.query<ResultSetHeader>(
        `INSERT IGNORE INTO ${orgUserTable} (${insertFields.join(',')}) VALUES ${valuesSql}`,
        params
      )

      await logUserAction({
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

  
  // 从机构移除某个用户（支持自动主组织重分配）
  async removeUser(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    const conn = await pool.getConnection()
    try {
      const orgTable = await getOrgTable()
      const orgUserTable = await getOrgUserTable()
      const orgUserCols = await getOrgUserColumns()

      const orgIdField = orgUserCols.has('org_id')
        ? 'org_id'
        : orgUserCols.has('organization_id')
        ? 'organization_id'
        : 'org_id'

      const orgId = Number(req.params.orgId)
      const userId = Number(req.params.userId)
      if (!Number.isFinite(orgId) || !Number.isFinite(userId)) {
        return res.status(400).json({ success: false, error: '无效的参数' })
      }

      await conn.beginTransaction()

      // 组织存在校验
      const [[orgExists]] = await conn.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [orgId])
      if (!orgExists) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '组织不存在' })
      }

      // 查询该用户在目标组织的关系
      const isPrimarySelect = orgUserCols.has('is_primary') ? ', IFNULL(is_primary,0) AS is_primary' : ''
      const [[rel]] = await conn.query<RowDataPacket[]>(
        `SELECT user_id, ${orgIdField}${isPrimarySelect}
         FROM ${orgUserTable}
        WHERE ${orgIdField}=? AND user_id=? LIMIT 1`,
        [orgId, userId]
      )
      if (!rel) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '该用户不在此组织下' })
      }

      const removingIsPrimary = orgUserCols.has('is_primary') ? Number((rel as any).is_primary) === 1 : false

      if (removingIsPrimary) {
        // 查找该用户的其它组织关系
        // 优先用时间列挑“最近/最早”一条；没有则任取一条
        let orderBy = ''
        if (orgUserCols.has('updated_at')) orderBy = ' ORDER BY updated_at DESC'
        else if (orgUserCols.has('created_at')) orderBy = ' ORDER BY created_at DESC'

        const [others] = await conn.query<RowDataPacket[]>(
          `SELECT ${orgIdField} AS org_id
           FROM ${orgUserTable}
          WHERE user_id=? AND ${orgIdField}<>?${orderBy}
          LIMIT 1`,
          [userId, orgId]
        )

        if ((others as any[]).length === 0) {
          // 没有其它组织，不允许删除主组织
          await conn.rollback()
          return res.status(400).json({ success: false, error: '该用户仅有此一个组织，不能移除其主组织' })
        }

        const nextOrgId = Number((others as any[])[0].org_id)

        if (orgUserCols.has('is_primary')) {
          // 先清掉该用户所有关系的主组织标记
          await conn.query(
            `UPDATE ${orgUserTable} SET is_primary=0${orgUserCols.has('updated_at') ? ', updated_at=NOW()' : ''}
            WHERE user_id=?`,
            [userId]
          )
          // 将另一条关系设为新主组织
          const [upd] = await conn.query<ResultSetHeader>(
            `UPDATE ${orgUserTable}
              SET is_primary=1${orgUserCols.has('updated_at') ? ', updated_at=NOW()' : ''}
            WHERE user_id=? AND ${orgIdField}=?`,
            [userId, nextOrgId]
          )
          if ((upd as ResultSetHeader).affectedRows === 0) {
            await conn.rollback()
            return res.status(500).json({ success: false, error: '主组织重分配失败' })
          }
        }
        // 再删除当前这条主组织关系
        const [ret] = await conn.query<ResultSetHeader>(
          `DELETE FROM ${orgUserTable} WHERE ${orgIdField}=? AND user_id=?`,
          [orgId, userId]
        )
        if (ret.affectedRows === 0) {
          await conn.rollback()
          return res.status(500).json({ success: false, error: '移除失败' })
        }
      } else {
        // 非主组织，直接删除
        const [ret] = await conn.query<ResultSetHeader>(
          `DELETE FROM ${orgUserTable} WHERE ${orgIdField}=? AND user_id=?`,
          [orgId, userId]
        )
        if (ret.affectedRows === 0) {
          await conn.rollback()
          return res.status(500).json({ success: false, error: '移除失败' })
        }
      }

      await conn.commit()

      await logUserAction({
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
      try {
        await conn.rollback()
      } catch {}
      console.error('移除机构用户错误:', error)
      return res.status(500).json({ success: false, error: '移除机构用户失败' })
    } finally {
      conn.release()
    }
  },

  // 将用户在某机构设为主组织
  async setPrimary(req: AuthRequest, res: Response<ApiResponse<{ user_id: number; org_id: number }>>) {
    const orgId = Number(req.params.orgId)
    const userId = Number(req.params.userId)
    if (!Number.isFinite(orgId) || !Number.isFinite(userId)) {
      return res.status(400).json({ success: false, error: '无效的参数' })
    }

    const conn = await pool.getConnection()
    try {
      const orgTable = await getOrgTable()
      const orgUserTable = await getOrgUserTable()
      const orgUserCols = await getOrgUserColumns()
      const orgIdField = orgUserCols.has('org_id')
        ? 'org_id'
        : orgUserCols.has('organization_id')
        ? 'organization_id'
        : 'org_id'

      await conn.beginTransaction()

      const [[org]] = await conn.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [orgId])
      const [[u]] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1', [userId])
      if (!org || !u) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '组织或用户不存在' })
      }

      // 确保用户-组织关系存在
      const insertFields = ['user_id', orgIdField]
      const insertValues = ['?', '?']
      if (orgUserCols.has('is_primary')) {
        insertFields.push('is_primary')
        insertValues.push('0')
      }
      if (orgUserCols.has('created_at')) {
        insertFields.push('created_at')
        insertValues.push('NOW()')
      }
      if (orgUserCols.has('updated_at')) {
        insertFields.push('updated_at')
        insertValues.push('NOW()')
      }

      await conn.query<ResultSetHeader>(
        `INSERT IGNORE INTO ${orgUserTable} (${insertFields.join(',')})
         VALUES (${insertValues.join(',')})`,
        [userId, orgId]
      )

      if (orgUserCols.has('is_primary')) {
        // 重置该用户的所有主组织标志
        await conn.query<ResultSetHeader>(
          `UPDATE ${orgUserTable} SET is_primary=0${
            orgUserCols.has('updated_at') ? ', updated_at=NOW()' : ''
          } WHERE user_id=?`,
          [userId]
        )

        // 设置新的主组织
        const [ret] = await conn.query<ResultSetHeader>(
          `UPDATE ${orgUserTable} SET is_primary=1${orgUserCols.has('updated_at') ? ', updated_at=NOW()' : ''}
           WHERE user_id=? AND ${orgIdField}=?`,
          [userId, orgId]
        )
        if (ret.affectedRows === 0) {
          await conn.rollback()
          return res.status(400).json({ success: false, error: '设置主组织失败' })
        }
      }

      await conn.commit()
      await logUserAction({
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
      try {
        await conn.rollback()
      } catch {}
      console.error('设置主组织错误:', error)
      return res.status(500).json({ success: false, error: '设置主组织失败' })
    } finally {
      conn.release()
    }
  },

  // 从 A 机构移动到 B 机构
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
      const orgTable = await getOrgTable()
      const orgUserTable = await getOrgUserTable()
      const orgUserCols = await getOrgUserColumns()
      const orgIdField = orgUserCols.has('org_id')
        ? 'org_id'
        : orgUserCols.has('organization_id')
        ? 'organization_id'
        : 'org_id'

      await conn.beginTransaction()

      const [[fo]] = await conn.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [fromOrgId])
      const [[to]] = await conn.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [toOrgId])
      const [[u]] = await conn.query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1', [userId])
      if (!fo || !to || !u) {
        await conn.rollback()
        return res.status(404).json({ success: false, error: '组织或用户不存在' })
      }

      // 插入到新组织
      const insertFields = ['user_id', orgIdField]
      const insertValues = ['?', '?']
      if (orgUserCols.has('is_primary')) {
        insertFields.push('is_primary')
        insertValues.push('0')
      }
      if (orgUserCols.has('created_at')) {
        insertFields.push('created_at')
        insertValues.push('NOW()')
      }
      if (orgUserCols.has('updated_at')) {
        insertFields.push('updated_at')
        insertValues.push('NOW()')
      }

      await conn.query(
        `INSERT IGNORE INTO ${orgUserTable} (${insertFields.join(',')})
         VALUES (${insertValues.join(',')})`,
        [userId, toOrgId]
      )

      if (orgUserCols.has('is_primary')) {
        // 重置所有主组织标志
        await conn.query(
          `UPDATE ${orgUserTable} SET is_primary=0${
            orgUserCols.has('updated_at') ? ', updated_at=NOW()' : ''
          } WHERE user_id=?`,
          [userId]
        )

        // 设置新的主组织
        const [ret1] = await conn.query<ResultSetHeader>(
          `UPDATE ${orgUserTable} SET is_primary=1${orgUserCols.has('updated_at') ? ', updated_at=NOW()' : ''}
           WHERE user_id=? AND ${orgIdField}=?`,
          [userId, toOrgId]
        )
        if (ret1.affectedRows === 0) {
          await conn.rollback()
          return res.status(500).json({ success: false, error: '设置目标主组织失败' })
        }
      }

      // 从原组织删除
      await conn.query(`DELETE FROM ${orgUserTable} WHERE user_id=? AND ${orgIdField}=?`, [userId, fromOrgId])
      await conn.commit()

      await logUserAction({
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
}

export default OrgUserController
