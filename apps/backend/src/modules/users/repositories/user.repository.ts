import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { pool } from '@/config/database.js'
import type { UserDTO, UserRole, UserStatus, UserSettings } from '../domain/user.model'

export class UserRepository {
  constructor(private readonly db: Pool = pool) {}

  // ✅ 创建用户，支持 phone/gender/remark
  async createUser(data: {
    username: string
    passwordHash: string
    email?: string | null
    nickname?: string | null
    role?: UserRole
    status?: UserStatus
    phone?: string | null
    gender?: '男' | '女' | '保密' | null
    remark?: string | null
  }): Promise<UserDTO> {
    const role = data.role ?? 'student'
    const status = data.status ?? 'active'

    const [ret] = await this.db.query<ResultSetHeader>(
      `INSERT INTO users
        (username, email, role, nickname, password, avatar_url, status, experience_points, level, school, class_name, phone, gender, remark, created_at, updated_at)
       VALUES
        (?, ?, ?, ?, ?, NULL, ?, 0, 1, NULL, NULL, ?, ?, ?, NOW(), NOW())`,
      [
        data.username,
        data.email ?? null,
        role,
        data.nickname ?? null,
        data.passwordHash,
        status,
        data.phone ?? null,
        data.gender ?? '保密',
        data.remark ?? null,
      ]
    )
    const id = Number(ret.insertId)
    const user = await this.getById(id)
    if (!user) throw new Error('CREATE_RETURN_EMPTY')
    return user
  }

  async getById(id: number): Promise<UserDTO | null> {
    const [rows] = await this.db.query<UserDTO[]>(
      `SELECT id, username, email, role, nickname, school, class_name, experience_points, level,
              avatar_url, status, phone, gender, remark, created_at, updated_at
         FROM users WHERE id = ?`,
      [id]
    )
    return rows[0] || null
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

  async list(params: { page: number; limit: number; role?: UserRole; search?: string }) {
    const { page, limit, role, search } = params
    const offset = (page - 1) * limit

    const clauses: string[] = []
    const values: any[] = []

    if (role) {
      clauses.push('role = ?')
      values.push(role)
    }
    if (search) {
      clauses.push('(username LIKE ? OR email LIKE ? OR nickname LIKE ? OR phone LIKE ?)')
      values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const [rows] = await this.db.query<UserDTO[]>(
      `SELECT id, username, email, role, nickname, school, class_name, experience_points, level,
              avatar_url, status, phone, gender, remark, created_at, updated_at
         FROM users ${where}
     ORDER BY created_at DESC
        LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    )

    const [cnt] = await this.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users ${where}`, values)

    return { users: rows, total: Number(cnt[0]?.total || 0) }
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
    const fields: string[] = []
    const values: any[] = []

    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) {
        fields.push(`${k} = ?`)
        values.push(v)
      }
    }
    if (!fields.length) return await this.getById(id)

    values.push(id)
    const [ret] = await this.db.query<ResultSetHeader>(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    )
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

  async deleteUser(id: number): Promise<boolean> {
    const conn = await this.db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        'DELETE FROM answer_records WHERE exam_result_id IN (SELECT id FROM exam_results WHERE user_id = ?)',
        [id]
      )
      await conn.query('DELETE FROM exam_results WHERE user_id = ?', [id])
      await conn.query('DELETE FROM tasks WHERE user_id = ?', [id])
      await conn.query('DELETE FROM notifications WHERE user_id = ?', [id])
      await conn.query('DELETE FROM user_organizations WHERE user_id = ?', [id])
      const [ret] = await conn.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id])
      await conn.commit()
      return ret.affectedRows > 0
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  // settings
  async getSettings(userId: number): Promise<UserSettings | null> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT settings FROM user_settings WHERE user_id = ?', [
      userId,
    ])
    if (!rows.length) return null
    const raw = rows[0].settings
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
