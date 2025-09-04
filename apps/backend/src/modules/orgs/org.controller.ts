import type { Response } from 'express'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../config/database.js'
import { LoggerService } from '../services/logger.service.js'
import type { AuthRequest } from '../types/auth.js'
import type { ApiResponse } from '../types/response.js'

/** 和你当前 organizations 表一致 */
interface IOrg extends RowDataPacket {
  id: number
  name: string
  code?: string | null
  parent_id?: number | null
  is_active: 0 | 1
  created_at: Date
  updated_at: Date
}

type OrgListData = {
  orgs: IOrg[]
  total: number
  page: number
  limit: number
}
type OrgTreeNode = IOrg & { children: OrgTreeNode[] }

/** 构树 */
function buildTree(rows: IOrg[], parentId: number | null = null): OrgTreeNode[] {
  const nodes = rows
    .filter(r => (r.parent_id ?? null) === parentId)
    .sort((a, b) => a.id - b.id)
    .map(r => ({ ...r, children: buildTree(rows, r.id) }))
  return nodes
}

/** 防环 */
function createsCycle(rows: IOrg[], nodeId: number, newParentId: number | null | undefined) {
  if (newParentId == null) return false

  // ✅ 用传入的 newParentId
  let cursor: number | null = newParentId

  const map = new Map<number, IOrg>(rows.map(r => [r.id, r]))
  while (cursor != null) {
    if (cursor === nodeId) return true
    // ✅ 避免与全局 parent 同名
    const p = map.get(cursor)
    cursor = p?.parent_id ?? null
  }
  return false
}

export const OrgController = {
  /** 列表 */
  async list(req: AuthRequest, res: Response<ApiResponse<OrgListData>>) {
    try {
      const page = Number(req.query.page ?? 1) || 1
      const limit = Math.min(100, Number(req.query.limit ?? 10) || 10)
      const offset = (page - 1) * limit
      const search = (req.query.search as string | undefined)?.trim()
      const parentId =
        typeof req.query.parent_id !== 'undefined' && req.query.parent_id !== ''
          ? Number(req.query.parent_id)
          : undefined
      const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true'

      const where: string[] = []
      const vals: any[] = []
      if (search) {
        where.push('(name LIKE ? OR code LIKE ?)')
        vals.push(`%${search}%`, `%${search}%`)
      }
      if (typeof parentId !== 'undefined' && !Number.isNaN(parentId)) {
        where.push('parent_id <=> ?')
        vals.push(parentId)
      }
      if (!includeInactive) {
        where.push('is_active = 1')
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const [rows] = await pool.query<IOrg[]>(
        `SELECT id, name, code, parent_id, is_active, created_at, updated_at
         FROM organizations
         ${whereSql}
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [...vals, limit, offset]
      )

      const [[cnt]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM organizations ${whereSql}`, vals)

      return res.json({
        success: true,
        data: { orgs: rows, total: Number((cnt as any)?.total) || 0, page, limit },
      })
    } catch (error) {
      console.error('获取组织列表错误:', error)
      return res.status(500).json({ success: false, error: '获取组织列表失败' })
    }
  },

  /** 树 */
  async getTree(req: AuthRequest, res: Response<ApiResponse<OrgTreeNode[]>>) {
    try {
      const includeInactive = req.query.include_inactive === '1' || req.query.include_inactive === 'true'
      const [rows] = await pool.query<IOrg[]>(
        `SELECT id, name, code, parent_id, is_active, created_at, updated_at
         FROM organizations
         ${includeInactive ? '' : 'WHERE is_active = 1'}
         ORDER BY id ASC`
      )
      return res.json({ success: true, data: buildTree(rows) })
    } catch (error) {
      console.error('获取组织树错误:', error)
      return res.status(500).json({ success: false, error: '获取组织树失败' })
    }
  },

  /** 详情 */
  async getById(req: AuthRequest, res: Response<ApiResponse<IOrg>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })

      const [rows] = await pool.query<IOrg[]>(
        `SELECT id, name, code, parent_id, is_active, created_at, updated_at
         FROM organizations WHERE id=? LIMIT 1`,
        [id]
      )
      if (rows.length === 0) return res.status(404).json({ success: false, error: '组织不存在' })
      return res.json({ success: true, data: rows[0] })
    } catch (error) {
      console.error('获取组织详情错误:', error)
      return res.status(500).json({ success: false, error: '获取组织详情失败' })
    }
  },

  /** 新增 */
  /** 创建组织 */
  async create(req: AuthRequest, res: Response<ApiResponse<{ id: number }>>) {
    try {
      const { name, code, parent_id, is_active } = req.body ?? {}

      if (!name || String(name).trim().length === 0) {
        return res.status(400).json({ success: false, error: '组织名称不能为空' })
      }

      let parentId: number | null = null
      if (parent_id !== undefined && parent_id !== null && parent_id !== '') {
        const n = Number(parent_id)
        if (!Number.isNaN(n)) parentId = n
      }

      // 关键：没有提供 code 或为空 → 自动生成并保证唯一
      const rawCode = typeof code === 'string' ? code.trim() : ''
      const base = rawCode || makeBaseCode(name)
      const finalCode = await ensureUniqueCode(base)

      const [ret] = await pool.query<ResultSetHeader>(
        `INSERT INTO organizations (name, code, parent_id, is_active, created_at, updated_at)
       VALUES (?,?,?,?,NOW(),NOW())`,
        [String(name).trim(), finalCode, parentId, is_active ? 1 : 1] // 默认启用
      )

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'create_org',
        resourceType: 'organization',
        resourceId: ret.insertId,
        details: { name, code: finalCode, parent_id: parentId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.status(201).json({ success: true, data: { id: ret.insertId } })
    } catch (error: any) {
      // 如果数据库有 UNIQUE 约束，仍可能撞车（极低概率）——返回更友好的信息
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, error: '组织编码已存在，请更换名称或编码' })
      }
      console.error('创建组织错误:', error)
      return res.status(500).json({ success: false, error: '创建组织失败' })
    }
  },

  /** 更新 */
  async update(req: AuthRequest, res: Response<ApiResponse<IOrg>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })

      const { name, code, parent_id, is_active } = req.body ?? {}
      const sets: string[] = []
      const vals: any[] = []

      if (name !== undefined) {
        if (!name || String(name).trim().length === 0) {
          return res.status(400).json({ success: false, error: '组织名称不能为空' })
        }
        sets.push('name=?')
        vals.push(String(name).trim())
      }
      if (code !== undefined) {
        sets.push('code=?')
        vals.push(code ?? null)
      }
      if (is_active !== undefined) {
        sets.push('is_active=?')
        vals.push(is_active ? 1 : 0)
      }
      if (parent_id !== undefined) {
        const parentId =
          parent_id === null || parent_id === '' ? null : Number.isNaN(Number(parent_id)) ? null : Number(parent_id)

        // 防环
        const [all] = await pool.query<IOrg[]>(
          'SELECT id, parent_id, name, code, is_active, created_at, updated_at FROM organizations'
        )
        if (createsCycle(all, id, parentId ?? null)) {
          return res.status(400).json({ success: false, error: '不能将组织移动到自身的子孙节点下' })
        }
        sets.push('parent_id=?')
        vals.push(parentId)
      }

      if (sets.length === 0) return res.status(400).json({ success: false, error: '没有提供要更新的字段' })

      sets.push('updated_at=NOW()')
      vals.push(id)

      const [ret] = await pool.query<ResultSetHeader>(`UPDATE organizations SET ${sets.join(', ')} WHERE id=?`, vals)
      if (ret.affectedRows === 0) return res.status(404).json({ success: false, error: '组织不存在' })

      const [rows] = await pool.query<IOrg[]>(
        `SELECT id, name, code, parent_id, is_active, created_at, updated_at FROM organizations WHERE id=?`,
        [id]
      )

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'update_org',
        resourceType: 'organization',
        resourceId: id,
        details: { updatedFields: sets },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: rows[0] })
    } catch (error) {
      console.error('更新组织错误:', error)
      return res.status(500).json({ success: false, error: '更新组织失败' })
    }
  },

  /** 删除（有子节点则不允许） */
  async delete(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })

      const [[exists]] = await pool.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [id])
      if (!exists) return res.status(404).json({ success: false, error: '组织不存在' })

      const [[child]] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM organizations WHERE parent_id=?',
        [id]
      )
      if (Number((child as any)?.cnt || 0) > 0) {
        return res.status(400).json({ success: false, error: '请先删除或移动该组织的子节点' })
      }

      const [ret] = await pool.query<ResultSetHeader>('DELETE FROM organizations WHERE id=?', [id])
      if (ret.affectedRows === 0) return res.status(500).json({ success: false, error: '删除组织失败' })

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'delete_org',
        resourceType: 'organization',
        resourceId: id,
        details: {},
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { message: '组织删除成功' } })
    } catch (error) {
      console.error('删除组织错误:', error)
      return res.status(500).json({ success: false, error: '删除组织失败' })
    }
  },

  /** 仅移动父节点 */
  async move(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: '无效的组织ID' })
      const { parent_id } = req.body ?? {}

      const [[exists]] = await pool.query<RowDataPacket[]>('SELECT id FROM organizations WHERE id=? LIMIT 1', [id])
      if (!exists) return res.status(404).json({ success: false, error: '组织不存在' })

      const parentId =
        parent_id === null || parent_id === '' || parent_id === undefined
          ? null
          : Number.isNaN(Number(parent_id))
          ? null
          : Number(parent_id)

      const [all] = await pool.query<IOrg[]>(
        'SELECT id, parent_id, name, code, is_active, created_at, updated_at FROM organizations'
      )
      if (createsCycle(all, id, parentId)) {
        return res.status(400).json({ success: false, error: '不能将组织移动到自身的子孙节点下' })
      }

      await pool.query(`UPDATE organizations SET parent_id=?, updated_at=NOW() WHERE id=?`, [parentId, id])

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'move_org',
        resourceType: 'organization',
        resourceId: id,
        details: { parent_id: parentId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { message: '移动成功' } })
    } catch (error) {
      console.error('移动组织错误:', error)
      return res.status(500).json({ success: false, error: '移动组织失败' })
    }
  },

  /** 批量仅更新 parent_id（无排序列） */
  async batchSort(req: AuthRequest, res: Response<ApiResponse<{ message: string }>>) {
    const updates: Array<{ id: number; parent_id?: number | null }> = req.body?.updates ?? []
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: '参数错误：updates 不能为空' })
    }

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const ids = Array.from(new Set(updates.map(u => u.id)))
      const [rows] = await conn.query<IOrg[]>(
        `SELECT id, parent_id FROM organizations WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      )

      for (const u of updates) {
        const pid = u.parent_id === undefined ? rows.find(r => r.id === u.id)?.parent_id ?? null : u.parent_id
        if (createsCycle(rows as IOrg[], u.id, pid ?? null)) {
          throw new Error(`更新将导致层级循环：id=${u.id}`)
        }
      }

      for (const u of updates) {
        const sets: string[] = []
        const vals: any[] = []
        if (u.parent_id !== undefined) {
          sets.push('parent_id=?')
          vals.push(u.parent_id)
        }
        if (!sets.length) continue
        sets.push('updated_at=NOW()')
        vals.push(u.id)
        await conn.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id=?`, vals)
      }

      await conn.commit()

      await LoggerService.logUserAction({
        userId: req.user?.id || 0,
        username: req.user?.username,
        action: 'batch_update_org_parent',
        resourceType: 'organization',
        resourceId: 0, // ✅ number
        details: { kind: 'batch', count: updates.length }, // ✅ 把信息放 details
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      })

      return res.json({ success: true, data: { message: '批量更新成功' } })
    } catch (error) {
      await conn.rollback()
      console.error('批量更新组织错误:', error)
      return res.status(500).json({ success: false, error: '批量更新失败' })
    } finally {
      conn.release()
    }
  },
}

/** 生成一个可读的编码（从name来，或回退到 org_时间戳_随机） */
function makeBaseCode(name?: string) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // 空白转 -
    .replace(/[^a-z0-9-]/g, '') // 非字母数字去掉
    .replace(/-+/g, '-') // 连续 - 压缩
    .replace(/^-|-$/g, '') // 去首尾 -
  return slug || `org_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
/** 确保编码唯一：base、base-1、base-2... */
async function ensureUniqueCode(base: string): Promise<string> {
  // 直接查是否存在
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT code FROM organizations WHERE code = ? LIMIT 1`, [base])
  if ((rows as any[]).length === 0) return base

  // 查已有的后缀，找下一个可用序号
  const [all] = await pool.query<RowDataPacket[]>(
    `SELECT code FROM organizations WHERE code = ? OR code LIKE CONCAT(?, '-%')`,
    [base, base]
  )
  const used = new Set((all as any[]).map(r => r.code as string))
  let i = 1
  while (used.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
export default OrgController
