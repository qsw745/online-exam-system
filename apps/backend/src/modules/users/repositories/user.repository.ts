/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { pool } from '@/config/database.js'
import type { UserDTO, UserRole, UserStatus, UserSettings } from '../domain/user.model'

// 探测 users 表是否有 username 列（缓存一次）
let _hasUserNameCol: boolean | null = null
async function hasUsernameCol(db: Pool | PoolConnection): Promise<boolean> {
  if (_hasUserNameCol != null) return _hasUserNameCol
  try {
    const [rows] = await db.query<RowDataPacket[]>('SHOW FULL COLUMNS FROM `users`')
    _hasUserNameCol = rows.some(r => String((r as any).Field).toLowerCase() === 'username')
  } catch {
    _hasUserNameCol = false
  }
  return _hasUserNameCol
}

// 统一选择字段：若没有 username 列，用 email AS username 做兼容
function selectFields(withUsername: boolean) {
  const uname = withUsername ? 'u.username' : 'u.email AS username'
  return `
    u.id, ${uname}, u.email, u.role, u.nickname, u.school, u.class_name, u.experience_points, u.level,
    u.avatar_url, u.status, u.phone, u.gender, u.remark, u.created_at, u.updated_at
  `
}

export class UserRepository {
  constructor(public readonly db: Pool = pool) {}

  async hasUsername(): Promise<boolean> {
    return hasUsernameCol(this.db)
  }

  // —— 小工具：探测某张表是否存在候选列 —— //
  private async detectColumn(
    runner: Pool | PoolConnection,
    table: string,
    candidates: string[]
  ): Promise<string | null> {
    try {
      const [cols] = await runner.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\``)
      const names = cols.map(c => String((c as any).Field).toLowerCase())
      const found = candidates.find(c => names.includes(c.toLowerCase()))
      return found || null
    } catch {
      return null
    }
  }

  // —— 获取 organizations 表父级列（自适配） —— //
  private async detectOrgParentColumn(runner: Pool | PoolConnection): Promise<string> {
    const col =
      (await this.detectColumn(runner, 'organizations', [
        'parent_id',
        'parentId',
        'pid',
        'p_id',
        'parent',
        'parentid',
      ])) || 'parent_id'
    return col
  }

  // —— 用递归 CTE 获取所有子孙 orgId（MySQL8+），失败则回退到 JS 遍历 —— //
  private async getOrgDescendantIds(rootOrgId: number, runner: Pool | PoolConnection): Promise<number[]> {
    const parentCol = await this.detectOrgParentColumn(runner)

    // 先尝试递归 CTE（MySQL 8）
    try {
      const sql = `
        WITH RECURSIVE org_tree AS (
          SELECT id FROM organizations WHERE id = ?
          UNION ALL
          SELECT o.id
          FROM organizations o
          JOIN org_tree t ON o.\`${parentCol}\` = t.id
        )
        SELECT id FROM org_tree
      `
      const [rows] = await runner.query<RowDataPacket[]>(sql, [rootOrgId])
      const ids = rows.map(r => Number((r as any).id)).filter(Number.isFinite)
      if (ids.length > 0) return Array.from(new Set(ids))
    } catch {
      // 忽略，回退到 JS
    }

    // 回退：一次性全量查 organizations -> JS 构建 children map 深度遍历
    try {
      const [all] = await runner.query<RowDataPacket[]>('SELECT id, ?? AS p FROM organizations', [parentCol] as any)
      const childrenMap = new Map<number, number[]>()
      for (const o of all) {
        const pid = (o as any).p ?? null
        const id = Number((o as any).id)
        if (!Number.isFinite(id)) continue
        if (pid != null) {
          const pnum = Number(pid)
          if (!childrenMap.has(pnum)) childrenMap.set(pnum, [])
          childrenMap.get(pnum)!.push(id)
        }
      }
      const stack = [rootOrgId]
      const seen = new Set<number>([rootOrgId])
      while (stack.length) {
        const cur = stack.pop()!
        const kids = childrenMap.get(cur) || []
        for (const k of kids) if (!seen.has(k)) seen.add(k), stack.push(k)
      }
      return Array.from(seen)
    } catch {
      // 最坏兜底：仅自身
      return [rootOrgId]
    }
  }

  // —— 特例：answer_records 外键名不一致时做探测 —— //
  private async detectAnswerRecordFk(runner: Pool | PoolConnection): Promise<string | null> {
    return this.detectColumn(runner, 'answer_records', ['exam_result_id', 'result_id', 'submission_id'])
  }

  // —— 批量删除（事务） —— //
  async deleteUsers(ids: number[]): Promise<number> {
    if (!ids.length) return 0
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()

      // 1) 先删答题明细（answer_records）：用 JOIN，外键列名自适配
      const arFk = await this.detectAnswerRecordFk(conn)
      if (arFk) {
        await conn.query(
          `DELETE ar FROM answer_records ar
             JOIN exam_results er ON ar.\`${arFk}\` = er.id
            WHERE er.user_id IN (?)`,
          [ids]
        )
      }

      // 2) 其它依赖表 —— 列名自适配（找不到就跳过，不报错）
      const paired: Array<{ table: string; candidates: string[] }> = [
        { table: 'exam_results', candidates: ['user_id', 'uid'] },
        { table: 'tasks', candidates: ['user_id', 'owner_id', 'assignee_id', 'uid'] },
        { table: 'notifications', candidates: ['user_id', 'recipient_id', 'uid'] },
        { table: 'user_organizations', candidates: ['user_id', 'uid'] },
        { table: 'user_org_roles', candidates: ['user_id', 'uid'] },
      ]

      for (const p of paired) {
        const col = await this.detectColumn(conn, p.table, p.candidates)
        if (col) {
          await conn.query(`DELETE FROM \`${p.table}\` WHERE \`${col}\` IN (?)`, [ids])
        }
      }

      // 3) 删除 users
      const [ret] = await conn.query<ResultSetHeader>('DELETE FROM users WHERE id IN (?)', [ids])

      await conn.commit()
      return Number(ret.affectedRows || 0)
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // —— 单个删除复用批量删除 —— //
  async deleteUser(id: number): Promise<boolean> {
    return (await this.deleteUsers([id])) > 0
  }

  // —— 唯一性预检 —— //
  async existsByEmail(email: string | null, db: Pool | PoolConnection = this.db): Promise<boolean> {
    if (!email) return false
    const [rows] = await db.query<RowDataPacket[]>('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email])
    return rows.length > 0
  }
  async existsByUsername(username?: string | null, db: Pool | PoolConnection = this.db): Promise<boolean> {
    if (!username) return false
    if (!(await hasUsernameCol(db))) return false
    const [rows] = await db.query<RowDataPacket[]>('SELECT 1 FROM users WHERE username = ? LIMIT 1', [username])
    return rows.length > 0
  }
  async existsByPhone(phone?: string | null, db: Pool | PoolConnection = this.db): Promise<boolean> {
    if (!phone) return false
    const [rows] = await db.query<RowDataPacket[]>('SELECT 1 FROM users WHERE phone = ? LIMIT 1', [phone])
    return rows.length > 0
  }

  // —— 创建用户（支持事务连接） —— //
  async createUser(
    data: {
      username?: string
      passwordHash: string
      email?: string | null
      nickname?: string | null
      role?: UserRole
      status?: UserStatus
      phone?: string | null
      gender?: '男' | '女' | '保密' | null
      remark?: string | null
    },
    conn?: PoolConnection
  ): Promise<UserDTO> {
    const role = data.role ?? 'student'
    const status = data.status ?? 'active'
    const runner: Pool | PoolConnection = conn || this.db
    const hasU = await hasUsernameCol(runner)

    const cols: string[] = []
    const vals: any[] = []

    if (hasU) {
      cols.push('username')
      vals.push(data.username ?? null)
    }
    cols.push(
      'email',
      'role',
      'nickname',
      'password',
      'avatar_url',
      'status',
      'experience_points',
      'level',
      'school',
      'class_name',
      'phone',
      'gender',
      'remark',
      'created_at',
      'updated_at'
    )
    vals.push(
      data.email ?? null,
      role,
      data.nickname ?? null,
      data.passwordHash,
      null,
      status,
      0,
      1,
      null,
      null,
      data.phone ?? null,
      data.gender ?? '保密',
      data.remark ?? null,
      new Date(),
      new Date()
    )

    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO users (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`
    const [ret] = await runner.query<ResultSetHeader>(sql, vals)
    const id = Number(ret.insertId)
    const user = await this.getById(id, runner)
    if (!user) throw new Error('CREATE_RETURN_EMPTY')
    return user
  }

  async getById(id: number, dbRunner: Pool | PoolConnection = this.db): Promise<UserDTO | null> {
    const hasU = await hasUsernameCol(dbRunner)
    const [rows] = await dbRunner.query<UserDTO[]>(
      `SELECT ${selectFields(hasU)}
         FROM users u WHERE u.id = ? LIMIT 1`,
      [id]
    )
    return rows[0] || null
  }

  async getPasswordHash(userId: number): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT password FROM users WHERE id = ? LIMIT 1', [userId])
    return (rows[0] && (rows[0] as any).password) || null
  }

  async statsOfUser(
    userId: number
  ): Promise<{ totalSubmissions: number; completedSubmissions: number; averageScore: number }> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
         COUNT(*) as totalSubmissions,
         SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completedSubmissions,
         AVG(CASE WHEN score IS NOT NULL THEN score ELSE 0 END) as averageScore
       FROM exam_results 
      WHERE user_id = ?`,
      [userId]
    )
    return {
      totalSubmissions: Number(rows[0]?.totalSubmissions || 0),
      completedSubmissions: Number(rows[0]?.completedSubmissions || 0),
      averageScore: Number(rows[0]?.averageScore || 0),
    }
  }

  async list(params: {
    page: number
    limit: number
    role?: UserRole
    search?: string
    email?: string
    nickname?: string
    phone?: string
    status?: UserStatus
  }) {
    const { page, limit, role, search, email, nickname, phone, status } = params
    const offset = (page - 1) * limit
    const hasU = await hasUsernameCol(this.db)

    const joins: string[] = []
    const clauses: string[] = []
    const values: any[] = []

    joins.push('LEFT JOIN user_organizations uo ON uo.user_id = u.id AND uo.is_primary = 1')
    joins.push('LEFT JOIN organizations o ON o.id = uo.org_id')

    if (role) {
      clauses.push('u.role = ?')
      values.push(role)
    }
    if (search) {
      if (hasU) {
        clauses.push('(u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
        values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
      } else {
        clauses.push('(u.email LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
        values.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }
    }
    if (email) {
      clauses.push('u.email LIKE ?')
      values.push(`%${email}%`)
    }
    if (nickname) {
      clauses.push('u.nickname LIKE ?')
      values.push(`%${nickname}%`)
    }
    if (phone) {
      clauses.push('u.phone LIKE ?')
      values.push(`%${phone}%`)
    }
    if (status) {
      clauses.push('u.status = ?')
      values.push(status)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const [rows] = await this.db.query<UserDTO[]>(
      `SELECT ${selectFields(hasU)},
              uo.org_id AS org_id,
              o.name AS org_name
         FROM users u
    ${joins.join('\n')}
        ${where}
     ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    )

    const [cnt] = await this.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users u ${where}`, values)
    return { users: rows, total: Number(cnt[0]?.total || 0) }
  }

  async listByOrg(params: {
    orgId: number
    page: number
    limit: number
    role?: string
    search?: string
    includeChildren?: boolean
    email?: string
    nickname?: string
    phone?: string
    status?: UserStatus
  }): Promise<{ items: UserDTO[]; total: number }> {
    const { orgId, page, limit, role, search, includeChildren, email, nickname, phone, status } = params

    const orgIds = includeChildren ? await this.getOrgDescendantIds(orgId, this.db) : [orgId]

    const hasU = await this.hasUsername()
    const clauses: string[] = []
    const vals: any[] = []
    if (role) {
      clauses.push('u.role = ?')
      vals.push(role)
    }
    if (search) {
      if (hasU) {
        clauses.push('(u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
        vals.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
      } else {
        clauses.push('(u.email LIKE ? OR u.nickname LIKE ? OR u.phone LIKE ?)')
        vals.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }
    }
    if (email) {
      clauses.push('u.email LIKE ?')
      vals.push(`%${email}%`)
    }
    if (nickname) {
      clauses.push('u.nickname LIKE ?')
      vals.push(`%${nickname}%`)
    }
    if (phone) {
      clauses.push('u.phone LIKE ?')
      vals.push(`%${phone}%`)
    }
    if (status) {
      clauses.push('u.status = ?')
      vals.push(status)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const offset = (page - 1) * limit

    const filterSubquery = `
      SELECT uo.user_id, MIN(uo.org_id) AS org_id
        FROM user_organizations uo
       WHERE uo.org_id IN (?)
       GROUP BY uo.user_id
    `

    const rowsSql = `
      SELECT ${selectFields(hasU)},
             filt.org_id AS org_id,
             o.name AS org_name
        FROM users u
        INNER JOIN (${filterSubquery}) AS filt ON filt.user_id = u.id
        LEFT JOIN organizations o ON o.id = filt.org_id
       ${where}
    ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?
    `

    const rowsParams = [orgIds, ...vals, limit, offset]
    const rowsRes: any = await this.db.query(rowsSql, rowsParams)
    const items: UserDTO[] = (rowsRes && rowsRes[0]) || []

    const countSql = `
      SELECT COUNT(*) AS total
        FROM users u
        INNER JOIN (${filterSubquery}) AS filt ON filt.user_id = u.id
       ${where}
    `
    const cntRes: any = await this.db.query(countSql, [orgIds, ...vals])
    const total = Number(((cntRes && cntRes[0] && cntRes[0][0]) || ({} as any)).total || 0)

    return { items, total }
  }

  async updateUser(
    id: number,
    patch: Partial<
      Pick<
        UserDTO,
        | 'username'
        | 'email'
        | 'role'
        | 'avatar_url'
        | 'nickname'
        | 'school'
        | 'class_name'
        | 'phone'
        | 'gender'
        | 'remark'
      >
    >
  ): Promise<UserDTO | null> {
    const hasU = await hasUsernameCol(this.db)
    const fields: string[] = []
    const values: any[] = []

    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null) continue
      if (k === 'username' && !hasU) continue
      fields.push(`${k} = ?`)
      values.push(v)
    }
    if (!fields.length) return await this.getById(id)

    fields.push('updated_at = NOW()')
    values.push(id)
    const [ret] = await this.db.query<ResultSetHeader>(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    if (!ret.affectedRows) return null
    return this.getById(id)
  }

  async updateStatus(id: number, status: UserStatus): Promise<boolean> {
    const [ret] = await this.db.query<ResultSetHeader>('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [
      status,
      id,
    ])
    return ret.affectedRows > 0
  }

  async resetPassword(id: number, hashed: string): Promise<boolean> {
    const [ret] = await this.db.query<ResultSetHeader>(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashed, id]
    )
    return ret.affectedRows >= 1
  }

  async getPrimaryOrgMeta(userId: number): Promise<{ orgId: number | null; org_name: string | null }> {
    const ret: any = await this.db.query(
      `SELECT uo.org_id, o.name AS org_name
         FROM user_organizations uo
         LEFT JOIN organizations o ON o.id = uo.org_id
        WHERE uo.user_id = ? AND uo.is_primary = 1
        LIMIT 1`,
      [userId]
    )
    const rows: RowDataPacket[] = (ret && ret[0]) || []
    const orgId = (rows?.[0] as any)?.org_id ?? null
    const org_name = (rows?.[0] as any)?.org_name ?? null
    return { orgId, org_name }
  }

  async setPrimaryOrg(userId: number, nextOrgId: number | null, runner?: PoolConnection): Promise<void> {
    const db = runner || this.db
    if (nextOrgId === null) {
      // 删除该用户的全部组织关联
      await db.query('DELETE FROM user_organizations WHERE user_id=?', [userId])
      return
    }
    // 移除其它组织，确保只保留当前主组织
    await db.query('DELETE FROM user_organizations WHERE user_id=? AND org_id <> ?', [userId, nextOrgId])
    await db.query(
      `INSERT INTO user_organizations (user_id, org_id, is_primary, assigned_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE is_primary=VALUES(is_primary), assigned_at=VALUES(assigned_at)`,
      [userId, nextOrgId]
    )
  }

  async getRolesForUserIds(ids: number[]): Promise<Array<{ id: number; role: UserRole }>> {
    if (!ids.length) return []
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT id, role FROM users WHERE id IN (?)', [ids])
    return rows.map(r => ({ id: Number((r as any).id), role: (r as any).role as UserRole }))
  }

  // settings
  async getSettings(userId: number): Promise<UserSettings | null> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT settings FROM user_settings WHERE user_id = ?', [
      userId,
    ])
    if (!rows.length) return null
    const raw = (rows[0] as any).settings
    if (typeof raw === 'object' && raw !== null) return raw as any
    try {
      return JSON.parse(raw as any)
    } catch {
      return null
    }
  }

  async saveSettings(userId: number, settings: UserSettings): Promise<void> {
    const existing = await this.getSettings(userId)
    const payload = JSON.stringify(settings)
    if (existing) {
      await this.db.query('UPDATE user_settings SET settings = ? WHERE user_id = ?', [payload, userId])
    } else {
      await this.db.query('INSERT INTO user_settings (user_id, settings) VALUES (?, ?)', [userId, payload])
    }
  }
}

export default UserRepository
