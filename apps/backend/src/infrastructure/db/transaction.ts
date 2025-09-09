import { pool } from './index.js'

type Conn = Awaited<ReturnType<typeof pool.getConnection>>

export async function withTransaction<T>(fn: (conn: Conn) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
