/* eslint-disable @typescript-eslint/no-explicit-any */
import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Row = RowDataPacket & {
  id: number
  email: string
  ip: string
  fail_count: number
  last_failed_at: Date | null
  locked_until: Date | null
  updated_at: Date | null
}

/** 避免 RowDataPacket 带来的 constructor.name 字面量类型冲突，单独定义补丁类型 */
type Patch = {
  fail_count?: number
  last_failed_at?: Date | null
  locked_until?: Date | null
}

const TABLE = 'auth_login_failures'

export const LoginFailureRepository = {
  async get(email: string, ip: string): Promise<Row | null> {
    const [rows] = await pool.query<Row[]>(
      `SELECT id,email,ip,fail_count,last_failed_at,locked_until,updated_at
       FROM ${TABLE} WHERE email=? AND ip=? LIMIT 1`,
      [email, ip]
    )
    return rows[0] ?? null
  },

  async upsert(email: string, ip: string, patch: Patch) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<Row[]>(`SELECT id FROM ${TABLE} WHERE email=? AND ip=? LIMIT 1`, [email, ip])
      if (rows[0]) {
        const fields: string[] = []
        const values: any[] = []
        if (typeof patch.fail_count === 'number') {
          fields.push('fail_count = ?')
          values.push(patch.fail_count)
        }
        if (patch.last_failed_at !== undefined) {
          fields.push('last_failed_at = ?')
          values.push(patch.last_failed_at)
        }
        if (patch.locked_until !== undefined) {
          fields.push('locked_until = ?')
          values.push(patch.locked_until)
        }
        fields.push('updated_at = NOW()')
        await conn.query<ResultSetHeader>(`UPDATE ${TABLE} SET ${fields.join(', ')} WHERE id = ?`, [
          ...values,
          rows[0].id,
        ])
      } else {
        await conn.query<ResultSetHeader>(
          `INSERT INTO ${TABLE} (email, ip, fail_count, last_failed_at, locked_until, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [
            email,
            ip,
            typeof patch.fail_count === 'number' ? patch.fail_count : 0,
            patch.last_failed_at ?? null,
            patch.locked_until ?? null,
          ]
        )
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  /** 失败 +1，返回最新计数 */
  async increase(email: string, ip: string) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<Row[]>(`SELECT id,fail_count FROM ${TABLE} WHERE email=? AND ip=? LIMIT 1`, [
        email,
        ip,
      ])
      let next = 1
      if (rows[0]) {
        next = (rows[0].fail_count || 0) + 1
        await conn.query<ResultSetHeader>(
          `UPDATE ${TABLE}
           SET fail_count = ?, last_failed_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [next, rows[0].id]
        )
      } else {
        await conn.query<ResultSetHeader>(
          `INSERT INTO ${TABLE} (email, ip, fail_count, last_failed_at, locked_until, updated_at)
           VALUES (?, ?, 1, NOW(), NULL, NOW())`,
          [email, ip]
        )
        next = 1
      }
      await conn.commit()
      return next
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  async reset(email: string, ip: string) {
    await pool.query<ResultSetHeader>(`DELETE FROM ${TABLE} WHERE email=? AND ip=?`, [email, ip])
  },

  /** 仅设置 locked_until（兼容老用法） */
  async lock(email: string, ip: string, until: Date) {
    await this.upsert(email, ip, { locked_until: until })
  },

  /** 加锁并同步 fail_count/last_failed_at，确保 locked_until 不为 NULL */
  async lockWithCount(email: string, ip: string, until: Date, count?: number) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<Row[]>(`SELECT id, fail_count FROM ${TABLE} WHERE email=? AND ip=? LIMIT 1`, [
        email,
        ip,
      ])
      if (rows[0]) {
        const newCount = typeof count === 'number' ? count : rows[0].fail_count || 0
        await conn.query<ResultSetHeader>(
          `UPDATE ${TABLE}
           SET fail_count = ?, locked_until = ?, last_failed_at = IFNULL(last_failed_at, NOW()), updated_at = NOW()
           WHERE id = ?`,
          [newCount, until, rows[0].id]
        )
      } else {
        await conn.query<ResultSetHeader>(
          `INSERT INTO ${TABLE} (email, ip, fail_count, last_failed_at, locked_until, updated_at)
           VALUES (?, ?, ?, NOW(), ?, NOW())`,
          [email, ip, typeof count === 'number' ? count : 0, until]
        )
      }
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  },

  /** 锁过期则释放锁并把 fail_count 置 0（关键修复点） */
  async unlockIfExpired(email: string, ip: string) {
    const rec = await this.get(email, ip)
    if (!rec?.locked_until) return
    if (Date.now() >= new Date(rec.locked_until).getTime()) {
      await this.upsert(email, ip, { locked_until: null, fail_count: 0 })
    }
  },

  /** last_failed_at 超过窗口则把 fail_count 置 0（过期计数衰减） */
  async decayIfStale(email: string, ip: string, windowMinutes: number) {
    const rec = await this.get(email, ip)
    if (!rec) return
    if ((rec.fail_count || 0) <= 0) return
    const lastMs = rec.last_failed_at ? new Date(rec.last_failed_at).getTime() : 0
    const winMs = Math.max(1, windowMinutes) * 60 * 1000
    if (!lastMs || Date.now() - lastMs > winMs) {
      await this.upsert(email, ip, { fail_count: 0 })
    }
  },
}
