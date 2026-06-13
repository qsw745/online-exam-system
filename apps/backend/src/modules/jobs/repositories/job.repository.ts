import { pool } from '@/config/database'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { SchedulerJob } from '../domain/job.model'

type Queryable = {
  query<T = any>(sql: string, params?: any[]): Promise<[T, any]>
}

const db: Queryable = pool as unknown as Queryable

export const JobRepository = {
  async list(): Promise<SchedulerJob[]> {
    const [rows] = await db.query<SchedulerJob[] & RowDataPacket[]>(
      'SELECT * FROM scheduler_jobs ORDER BY id DESC'
    )
    return rows as SchedulerJob[]
  },

  async create(payload: { name: string; cron: string; handler: string; status?: string; description?: string; meta?: any }): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>(
      'INSERT INTO scheduler_jobs (name, cron, handler, status, description, meta) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.name, payload.cron, payload.handler, payload.status ?? 'paused', payload.description ?? null, payload.meta ?? null]
    )
    return ret.insertId
  },

  async update(id: number, payload: {
    name?: string
    cron?: string
    handler?: string
    status?: string
    description?: string
    meta?: any
    next_run_at?: Date | string | null
    last_run_at?: Date | string | null
  }): Promise<number> {
    const sets: string[] = []
    const vals: any[] = []
    ;(['name', 'cron', 'handler', 'status', 'description', 'meta', 'next_run_at', 'last_run_at'] as const).forEach(key => {
      if (payload[key] !== undefined) {
        sets.push(`${key} = ?`)
        vals.push(payload[key] as any)
      }
    })
    if (!sets.length) return 0
    const [ret] = await db.query<ResultSetHeader>(
      `UPDATE scheduler_jobs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      [...vals, id]
    )
    return ret.affectedRows
  },

  async remove(id: number): Promise<number> {
    const [ret] = await db.query<ResultSetHeader>('DELETE FROM scheduler_jobs WHERE id = ?', [id])
    return ret.affectedRows
  },
}
