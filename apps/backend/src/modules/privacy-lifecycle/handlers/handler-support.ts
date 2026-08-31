import type { PoolConnection } from 'mysql2/promise'

import type { LifecycleCategoryCode } from '../domain/lifecycle.model'
import type {
  LifecycleBatchResult,
  LifecycleHandler,
  LifecycleHandlerContext,
  LifecycleTransaction,
} from '../services/lifecycle-worker.service'

export interface LifecycleHandlerDatabase {
  withTransaction<T>(operation: (connection: LifecycleTransaction) => Promise<T>): Promise<T>
}

export class MysqlLifecycleHandlerDatabase implements LifecycleHandlerDatabase {
  async withTransaction<T>(operation: (connection: LifecycleTransaction) => Promise<T>): Promise<T> {
    const { pool } = await import('@/config/database')
    const connection = (await (pool as any).getConnection()) as PoolConnection
    try {
      await connection.beginTransaction()
      const result = await operation(connection as unknown as LifecycleTransaction)
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}

export const requireAccountParent = (context: LifecycleHandlerContext) => {
  if (context.parent.kind !== 'ACCOUNT_DELETION' || context.parent.userId == null) {
    throw Object.assign(new Error('处理器只接受仍有关联主体的账号注销任务'), {
      code: 'LIFECYCLE_PARENT_INVALID',
      recoverable: false,
    })
  }
  return context.parent
}

type FixedTableSpec = {
  table: string
  subjectColumn: string
  mode?: 'DELETE' | 'CLEAR'
  clearColumns?: readonly string[]
}

const SQL_IDENTIFIER = /^[a-z][a-z0-9_]*$/
const assertFixedSpecs = (specs: readonly FixedTableSpec[]) => {
  for (const spec of specs) {
    for (const identifier of [spec.table, spec.subjectColumn, ...(spec.clearColumns ?? [])]) {
      if (!SQL_IDENTIFIER.test(identifier)) {
        throw Object.assign(new Error('生命周期处理器包含非固定 SQL 标识符'), {
          code: 'LIFECYCLE_HANDLER_IDENTIFIER_INVALID',
        })
      }
    }
  }
}

const parseCursor = (value: string | number | undefined): { tableIndex: number; afterId: number } => {
  if (typeof value === 'number') return { tableIndex: 0, afterId: Math.max(0, value) }
  const match = String(value ?? '').match(/^(\d{3}):(\d+)$/)
  return match ? { tableIndex: Number(match[1]), afterId: Number(match[2]) } : { tableIndex: 0, afterId: 0 }
}

const encodeCursor = (tableIndex: number, afterId: number) =>
  `${String(tableIndex).padStart(3, '0')}:${String(Math.max(0, Math.trunc(afterId))).padStart(20, '0')}`

const tableExists = async (connection: LifecycleTransaction, table: string): Promise<boolean> => {
  const [rows] = await connection.query(
    `SELECT 1 AS present FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1`,
    [table],
  )
  return Array.isArray(rows) && rows.length > 0
}

const affectedRows = (value: unknown): number => Number((value as { affectedRows?: unknown })?.affectedRows || 0)

export function createFixedTableHandler(input: {
  stepCode: string
  category: LifecycleCategoryCode
  database: LifecycleHandlerDatabase
  specs: readonly FixedTableSpec[]
}): LifecycleHandler {
  assertFixedSpecs(input.specs)
  return {
    stepCode: input.stepCode,
    category: input.category,
    async planCount(context) {
      const parent = requireAccountParent(context)
      return input.database.withTransaction(async connection => {
        let total = 0
        for (const spec of input.specs) {
          if (!(await tableExists(connection, spec.table))) continue
          const [rows] = await connection.query(
            `SELECT COUNT(*) AS total FROM ${spec.table} WHERE ${spec.subjectColumn}=?`,
            [parent.userId],
          )
          total += Number((rows as any[])?.[0]?.total || 0)
        }
        return total
      })
    },
    async executeBatch(context): Promise<LifecycleBatchResult> {
      const parent = requireAccountParent(context)
      const start = parseCursor(context.cursor?.afterId)
      return input.database.withTransaction(async connection => {
        for (let tableIndex = start.tableIndex; tableIndex < input.specs.length; tableIndex += 1) {
          const spec = input.specs[tableIndex]
          if (!(await tableExists(connection, spec.table))) continue
          const afterId = tableIndex === start.tableIndex ? start.afterId : 0
          const [rows] = await connection.query(
            `SELECT id FROM ${spec.table}
              WHERE ${spec.subjectColumn}=? AND id>? ORDER BY id LIMIT ?`,
            [parent.userId, afterId, context.batchSize],
          )
          const ids = (rows as Array<{ id: string | number }>).map(row => row.id)
          if (ids.length === 0) continue
          const placeholders = ids.map(() => '?').join(',')
          let result: unknown
          if (spec.mode === 'CLEAR') {
            const columns = [spec.subjectColumn, ...(spec.clearColumns ?? [])]
            ;[result] = await connection.query(
              `UPDATE ${spec.table} SET ${columns.map(column => `${column}=NULL`).join(', ')}
                WHERE id IN (${placeholders})`,
              ids,
            )
          } else {
            ;[result] = await connection.query(`DELETE FROM ${spec.table} WHERE id IN (${placeholders})`, ids)
          }
          const lastId = Number(ids[ids.length - 1])
          const tableDone = ids.length < context.batchSize
          const lastTable = tableIndex === input.specs.length - 1
          return {
            processedCount: Math.max(ids.length, affectedRows(result)),
            nextCursor: tableDone && !lastTable
              ? { afterId: encodeCursor(tableIndex + 1, 0) }
              : tableDone && lastTable
                ? null
                : { afterId: encodeCursor(tableIndex, lastId) },
            done: tableDone && lastTable,
          }
        }
        return { processedCount: 0, nextCursor: null, done: true }
      })
    },
  }
}

export const defaultLifecycleHandlerDatabase = new MysqlLifecycleHandlerDatabase()
