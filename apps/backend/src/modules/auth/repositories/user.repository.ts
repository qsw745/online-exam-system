/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { IUser } from '../domain/auth.model'
import { pool as basePool } from '@/config/database'

interface DBPool {
  execute<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

/** —— SQL 调试包装器：失败必打，成功在 DEBUG_SQL=1 时打 —— */
function wrapSqlDebug<TPool extends { execute: Function }>(p: TPool): DBPool {
  return {
    async execute<T = any>(sql: string, params?: any[]): Promise<[T, any]> {
      const start = Date.now()
      try {
        const ret = (await (p as any).execute(sql, params)) as [T, any]
        if (String(process.env.DEBUG_SQL || '') === '1') {
          console.log('[SQL OK]', { tookMs: Date.now() - start, sql, parameters: params })
        }
        return ret
      } catch (err: any) {
        // 补充关键信息 + 控制台直打
        if (err && !err.sql) err.sql = sql
        if (err && !err.parameters) err.parameters = params
        console.error('[SQL ERROR]', {
          code: err?.code,
          errno: err?.errno,
          sqlState: err?.sqlState || err?.sqlstate,
          sql: sql,
          parameters: params,
          message: err?.sqlMessage || err?.message,
          tookMs: Date.now() - start,
          stack: err?.stack,
        })
        throw err
      }
    },
  }
}
const pool = wrapSqlDebug(basePool as any as { execute: Function })

type RoleRow = RowDataPacket & { id: number; code: string }
type DefaultRoleRow = RowDataPacket & { role_id: number }
type OAuthProvider = 'github' | 'google'

/** ---------- users 表列缓存 & 工具 ---------- */
let _allUserCols: string[] | null = null
let _userCols: string[] | null = null
async function loadAllUserColumns(): Promise<string[]> {
  if (_allUserCols) return _allUserCols
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(`SHOW FULL COLUMNS FROM \`users\``)
    _allUserCols = rows.map(r => String((r as any).Field))
    return _allUserCols
  } catch {
    _allUserCols = ['id', 'email', 'password', 'status']
    return _allUserCols
  }
}
async function loadUserColumns(): Promise<string[]> {
  if (_userCols) return _userCols
  // 排除 username（即使存在也不选出，避免上下游再误用）
  _userCols = (await loadAllUserColumns()).filter(n => n.toLowerCase() !== 'username')
  return _userCols
}
function colsSql(cols: string[]): string {
  return cols.map(c => `\`${c}\``).join(', ')
}
function usernameBase(email: string, nickname?: string | null): string {
  const raw = String(nickname || email.split('@')[0] || 'user')
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[\s._]+/g, '-')
      .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'user'
  )
}
async function nextUsername(email: string, nickname?: string | null): Promise<string> {
  const base = usernameBase(email, nickname)
  for (let i = 0; i < 20; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 8)
    const candidate = `${base}-${suffix}`.slice(0, 64)
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT 1 FROM users WHERE username=? LIMIT 1', [candidate])
    if (!rows.length) return candidate
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 64)
}

export class UserRepository {
  /** 仅按邮箱查（已不支持用户名登录） */
  static async findByEmail(email: string): Promise<IUser | null> {
    const cols = await loadUserColumns()
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${colsSql(cols)} FROM users WHERE email=? LIMIT 1`, [
      email,
    ])
    return (rows[0] as unknown as IUser) || null
  }

  /** 登录查找：只用邮箱 */
  static async findByLogin(login: string): Promise<IUser | null> {
    const v = String(login || '').trim()
    if (!v) return null
    return this.findByEmail(v)
  }

  static async findById(id: number): Promise<IUser | null> {
    const cols = await loadUserColumns()
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${colsSql(cols)} FROM users WHERE id=? LIMIT 1`, [id])
    return (rows[0] as unknown as IUser) || null
  }

  /** 标记邮箱已验证 */
  static async markEmailVerified(userId: number): Promise<void> {
    await pool.execute(`UPDATE users SET email_verified=1, email_verified_at=NOW() WHERE id=?`, [userId])
  }

  static async findByOAuth(provider: OAuthProvider, providerUserId: string): Promise<IUser | null> {
    const cols = await loadUserColumns()
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT ${cols.map(c => `u.\`${c}\``).join(', ')}
         FROM user_oauth_accounts oa
         JOIN users u ON u.id = oa.user_id
        WHERE oa.provider=? AND oa.provider_user_id=?
        LIMIT 1`,
      [provider, providerUserId]
    )
    return (rows[0] as unknown as IUser) || null
  }

  /**
   * 插入用户（邮箱+密码为主）：
   * - 优先 nickname/email/password/status（若无 nickname 自动降级）
   * - 若表存在 username 列，自动生成唯一 username，兼容 username NOT NULL 的历史表结构
   * - 占位符与参数数量严格匹配（避免 Malformed communication packet）
   */
  static async insertUser(params: {
    email: string
    hashed: string
    nickname?: string | null
  }): Promise<{ id: number }> {
    const colsAll = await loadAllUserColumns()
    const hasNickname = colsAll.includes('nickname')
    const hasUsername = colsAll.includes('username')

    const cols: string[] = []
    const vals: any[] = []

    if (hasUsername) {
      cols.push('username')
      vals.push(await nextUsername(params.email, params.nickname))
    }
    if (hasNickname) {
      cols.push('nickname')
      vals.push(params.nickname ?? null)
    }
    cols.push('email', 'password', 'status')
    vals.push(params.email, params.hashed, 'active')

    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO users (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`

    const [rs] = await pool.execute<ResultSetHeader>(sql, vals)
    return { id: rs.insertId }
  }

  static async rolesOfUser(userId: number): Promise<{ roles: { id: number; code: string }[]; roleIds: number[] }> {
    const [rows] = await pool.execute<RoleRow[]>(
      `SELECT r.id, r.code
         FROM roles r
         JOIN user_org_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = ?`,
      [userId]
    )
    const roles = rows.map(r => ({ id: Number(r.id), code: String(r.code).toLowerCase() }))
    return { roles, roleIds: roles.map(r => r.id) }
  }

  static async upsertOAuthAccount(params: {
    userId: number
    provider: OAuthProvider
    providerUserId: string
    email: string
    displayName?: string | null
    avatarUrl?: string | null
  }) {
    await pool.execute(
      `INSERT INTO user_oauth_accounts
        (user_id, provider, provider_user_id, email, display_name, avatar_url, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
        email=VALUES(email),
        display_name=VALUES(display_name),
        avatar_url=VALUES(avatar_url),
        last_login_at=NOW()`,
      [
        params.userId,
        params.provider,
        params.providerUserId,
        params.email,
        params.displayName ?? null,
        params.avatarUrl ?? null,
      ]
    )
  }
}

export class OrgRepository {
  static async getDefaultOrgId(): Promise<number> {
    const [orgRows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM organizations WHERE code='default' LIMIT 1`)
    const org = orgRows[0] as RowDataPacket | undefined
    const orgId = Number((org as any)?.id)
    if (!orgId) throw new Error('默认机构不存在，请先执行迁移脚本')
    return orgId
  }

  static async attachUserToOrg(userId: number, orgId: number) {
    await pool.execute(
      `INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, assigned_at) VALUES (?, ?, 1, NOW())`,
      [userId, orgId]
    )
  }

  static async defaultRoleIdsOfOrg(orgId: number): Promise<number[]> {
    const [defs] = await pool.execute<DefaultRoleRow[]>(`SELECT role_id FROM org_default_roles WHERE org_id=?`, [orgId])
    return defs.map(r => Number(r.role_id))
  }

  static async ensureUserRoles(userId: number, orgId: number, roleIds: number[]) {
    for (const rid of roleIds) {
      await pool.execute(
        `INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at) VALUES (?, ?, ?, NOW())`,
        [userId, orgId, rid]
      )
    }
  }

  static async findRoleIdByCode(code: string): Promise<number | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT id FROM roles WHERE LOWER(code)=LOWER(?) LIMIT 1`, [code])
    const row = rows[0] as RowDataPacket | undefined
    return row ? Number((row as any).id) : null
  }
}
