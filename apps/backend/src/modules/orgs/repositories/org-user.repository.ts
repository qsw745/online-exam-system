// apps/backend/src/modules/orgs/repositories/org-user.repository.ts
import { pool } from '@config/database.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

/** —— 动态探测缓存 —— */
let cachedOrgTable: string | null = null
let cachedOrgUserTable: string | null = null
let cachedOrgUserColumns: Set<string> | null = null
let cachedUserCols: Set<string> | null = null

export async function getOrgTable(): Promise<string> {
  if (cachedOrgTable) return cachedOrgTable
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
  )
  const names = new Set((rows as any[]).map(r => String(r.table_name).toLowerCase()))
  cachedOrgTable = names.has('organizations') ? 'organizations' : names.has('orgs') ? 'orgs' : 'organizations'
  return cachedOrgTable
}

export async function getOrgUserTable(): Promise<string> {
  if (cachedOrgUserTable) return cachedOrgUserTable
  const candidates = ['user_organizations', 'org_users', 'user_org', 'org_user', 'user_orgs']
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`
  )
  const names = new Set((rows as any[]).map(r => String(r.table_name).toLowerCase()))
  cachedOrgUserTable = candidates.find(t => names.has(t)) ?? 'user_organizations'
  return cachedOrgUserTable
}

export async function getOrgUserColumns(): Promise<Set<string>> {
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

export async function getUserCols(): Promise<Set<string>> {
  if (cachedUserCols) return cachedUserCols
  const [cols] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM users`)
  cachedUserCols = new Set((cols as any[]).map(c => String(c.Field)))
  return cachedUserCols
}

export const OrgUserRepository = {
  async orgExists(orgId: number): Promise<boolean> {
    const orgTable = await getOrgTable()
    const [[org]] = await pool.query<RowDataPacket[]>(`SELECT id FROM ${orgTable} WHERE id=? LIMIT 1`, [orgId])
    return !!org
  },

  async userIdsExisting(userIds: number[]): Promise<number[]> {
    if (!userIds.length) return []
    const [validUsers] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    )
    return (validUsers as any[]).map(r => Number(r.id))
  },

  async countUsers(whereSQL: string, whereVals: any[]): Promise<number> {
    const orgUserTable = await getOrgUserTable()
    const [[cnt]] = await pool.query<RowDataPacket[]>(
      `
      SELECT COUNT(DISTINCT u.id) AS total
        FROM users u
        JOIN ${orgUserTable} uo ON uo.user_id = u.id
       ${whereSQL}
      `,
      whereVals
    )
    return Number((cnt as any)?.total) || 0
  },

  async listUsers(selectCols: string[], whereSQL: string, whereVals: any[], page: number, limit: number) {
    const offset = (page - 1) * limit
    const orgUserTable = await getOrgUserTable()
    const orgTable = await getOrgTable()
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT ${selectCols.join(', ')},
             uo.${await this.orgIdField()} AS org_id,
             o.name AS org_name
        FROM users u
        JOIN ${orgUserTable} uo ON uo.user_id = u.id
        LEFT JOIN ${orgTable} o ON o.id = uo.${await this.orgIdField()}
       ${whereSQL}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?
      `,
      [...whereVals, limit, offset]
    )
    return rows as any[]
  },

  async orgIdField(): Promise<'org_id' | 'organization_id'> {
    const cols = await getOrgUserColumns()
    return (cols.has('org_id') ? 'org_id' : 'organization_id') as any
  },

  async insertIgnoreUserOrgs(orgId: number, userIds: number[]) {
    const table = await getOrgUserTable()
    const cols = await getOrgUserColumns()
    const orgIdField = await this.orgIdField()

    const insertFields = ['user_id', orgIdField]
    const insertValues = ['?', '?']
    if (cols.has('is_primary')) {
      insertFields.push('is_primary')
      insertValues.push('0')
    }
    if (cols.has('created_at')) {
      insertFields.push('created_at')
      insertValues.push('NOW()')
    }
    if (cols.has('updated_at')) {
      insertFields.push('updated_at')
      insertValues.push('NOW()')
    }

    const valuesSql = userIds.map(() => `(${insertValues.join(',')})`).join(',')
    const params: any[] = []
    userIds.forEach(uid => params.push(uid, orgId))
    const [ret] = await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO ${table} (${insertFields.join(',')}) VALUES ${valuesSql}`,
      params
    )
    return ret.affectedRows
  },

  async relOfUserInOrg(orgId: number, userId: number) {
    const table = await getOrgUserTable()
    const cols = await getOrgUserColumns()
    const orgIdField = await this.orgIdField()
    const isPrimarySelect = cols.has('is_primary') ? ', IFNULL(is_primary,0) AS is_primary' : ''
    const [[rel]] = await pool.query<RowDataPacket[]>(
      `SELECT user_id, ${orgIdField} ${isPrimarySelect} FROM ${table} WHERE ${orgIdField}=? AND user_id=? LIMIT 1`,
      [orgId, userId]
    )
    return rel ?? null
  },

  async anotherOrgForUser(userId: number, excludeOrgId: number) {
    const table = await getOrgUserTable()
    const cols = await getOrgUserColumns()
    const orgIdField = await this.orgIdField()
    let orderBy = ''
    if (cols.has('updated_at')) orderBy = ' ORDER BY updated_at DESC'
    else if (cols.has('created_at')) orderBy = ' ORDER BY created_at DESC'
    const [others] = await pool.query<RowDataPacket[]>(
      `SELECT ${orgIdField} AS org_id FROM ${table} WHERE user_id=? AND ${orgIdField}<>?${orderBy} LIMIT 1`,
      [userId, excludeOrgId]
    )
    return (others as any[])[0]?.org_id as number | undefined
  },

  async clearAllPrimary(userId: number) {
    const table = await getOrgUserTable()
    const cols = await getOrgUserColumns()
    if (!cols.has('is_primary')) return 0
    const [ret] = await pool.query<ResultSetHeader>(
      `UPDATE ${table} SET is_primary=0${cols.has('updated_at') ? ', updated_at=NOW()' : ''} WHERE user_id=?`,
      [userId]
    )
    return ret.affectedRows
  },

  async setPrimary(userId: number, orgId: number) {
    const table = await getOrgUserTable()
    const cols = await getOrgUserColumns()
    const orgIdField = await this.orgIdField()
    if (!cols.has('is_primary')) return 0
    const [ret] = await pool.query<ResultSetHeader>(
      `UPDATE ${table} SET is_primary=1${
        cols.has('updated_at') ? ', updated_at=NOW()' : ''
      } WHERE user_id=? AND ${orgIdField}=?`,
      [userId, orgId]
    )
    return ret.affectedRows
  },

  async deleteRel(userId: number, orgId: number) {
    const table = await getOrgUserTable()
    const orgIdField = await this.orgIdField()
    const [ret] = await pool.query<ResultSetHeader>(`DELETE FROM ${table} WHERE ${orgIdField}=? AND user_id=?`, [
      orgId,
      userId,
    ])
    return ret.affectedRows
  },

  async ensureRel(userId: number, orgId: number) {
    const table = await getOrgUserTable()
    const cols = await getOrgUserColumns()
    const orgIdField = await this.orgIdField()
    const insertFields = ['user_id', orgIdField]
    const insertValues = ['?', '?']
    if (cols.has('is_primary')) {
      insertFields.push('is_primary')
      insertValues.push('0')
    }
    if (cols.has('created_at')) {
      insertFields.push('created_at')
      insertValues.push('NOW()')
    }
    if (cols.has('updated_at')) {
      insertFields.push('updated_at')
      insertValues.push('NOW()')
    }
    await pool.query<ResultSetHeader>(
      `INSERT IGNORE INTO ${table} (${insertFields.join(',')}) VALUES (${insertValues.join(',')})`,
      [userId, orgId]
    )
  },
}
