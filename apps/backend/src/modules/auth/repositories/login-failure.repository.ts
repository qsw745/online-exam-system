import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

type Row = RowDataPacket & {
    id: number
    email: string
    ip: string
    fail_count: number
    last_failed_at: Date
}

export const LoginFailureRepository = {
    async get(email: string, ip: string): Promise<Row | null> {
        const [rows] = await pool.query<Row[]>(`SELECT * FROM auth_login_failures WHERE email=? AND ip=? LIMIT 1`, [
            email,
            ip,
        ])
        return rows[0] ?? null
    },

    async increase(email: string, ip: string) {
        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            const [rows] = await conn.query<Row[]>(
                `SELECT * FROM auth_login_failures WHERE email=? AND ip=? LIMIT 1`,
                [email, ip]
            )
            if (rows[0]) {
                await conn.query<ResultSetHeader>(
                    `UPDATE auth_login_failures SET fail_count = fail_count + 1, last_failed_at = NOW() WHERE id=?`,
                    [rows[0].id]
                )
            } else {
                await conn.query<ResultSetHeader>(
                    `INSERT INTO auth_login_failures (email, ip, fail_count, last_failed_at) VALUES (?, ?, 1, NOW())`,
                    [email, ip]
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

    async reset(email: string, ip: string) {
        await pool.query<ResultSetHeader>(`DELETE FROM auth_login_failures WHERE email=? AND ip=?`, [email, ip])
    },
}
