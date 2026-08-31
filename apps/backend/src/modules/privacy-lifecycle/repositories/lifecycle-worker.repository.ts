import { pool } from '@/config/database'
import type {
  DataRegion,
  LifecycleCategoryCode,
  LifecyclePolicySnapshot,
  LifecycleStepStatus,
  RetentionAction,
} from '../domain/lifecycle.model'
import type {
  ClaimedLifecycleStep,
  LifecycleBatchCompletion,
  LifecycleCursor,
  LifecycleParentContext,
  LifecycleWorkerRepositoryContract,
} from '../services/lifecycle-worker.service'

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback
  if (typeof value === 'object') return value as T
  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}

const asDate = (value: unknown): Date => {
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('生命周期父记录时间无效'), { code: 'LIFECYCLE_PARENT_INVALID' })
  }
  return date
}

export interface LifecycleWorkerConnection {
  query<T = any>(sql: string, params?: unknown[]): Promise<[T, unknown]>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}

export interface LifecycleWorkerDatabase {
  query<T = any>(sql: string, params?: unknown[]): Promise<[T, unknown]>
  getConnection(): Promise<LifecycleWorkerConnection>
}

const assertOwnedStep = async (connection: LifecycleWorkerConnection, stepId: string, workerId: string) => {
  const [rows] = await connection.query<any[]>(
    `SELECT id, step_id, request_id, scan_run_id, cursor_json, processed_count, attempt_count
       FROM data_lifecycle_steps
      WHERE step_id=? AND lease_owner=? AND status='RUNNING'
      LIMIT 1 FOR UPDATE`,
    [stepId, workerId],
  )
  const row = rows[0]
  if (!row) {
    throw Object.assign(new Error('生命周期步骤租约已失效'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
  }
  return row
}

const compareCursor = (previous: LifecycleCursor | null, next: LifecycleCursor | null): void => {
  if (!previous || !next) return
  const previousNumber = Number(previous.afterId)
  const nextNumber = Number(next.afterId)
  if (
    (Number.isFinite(previousNumber) && Number.isFinite(nextNumber) && nextNumber < previousNumber) ||
    (!Number.isFinite(previousNumber) && String(next.afterId) < String(previous.afterId))
  ) {
    throw Object.assign(new Error('生命周期步骤游标不能倒退'), { code: 'LIFECYCLE_CURSOR_REGRESSION' })
  }
}

const syncParentStatus = async (
  connection: LifecycleWorkerConnection,
  parent: { request_id?: string | null; scan_run_id?: string | null },
): Promise<void> => {
  const parentColumn = parent.request_id ? 'request_id' : 'scan_run_id'
  const parentId = parent.request_id ?? parent.scan_run_id
  if (!parentId) return
  const [counts] = await connection.query<any[]>(
    `SELECT
       SUM(status='ATTENTION_REQUIRED') AS attention_count,
       SUM(status='HELD' AND action<>'RESTRICTED_RETENTION') AS blocking_held_count,
       SUM(status='RETRYING') AS retry_count,
       SUM(status='RUNNING') AS running_count,
       SUM(status<>'COMPLETED' AND NOT(status='HELD' AND action='RESTRICTED_RETENTION')) AS incomplete_count
       FROM data_lifecycle_steps
      WHERE ${parentColumn}=?`,
    [parentId],
  )
  const count = counts[0] ?? {}
  let status = 'SCHEDULED'
  if (Number(count.attention_count) > 0) status = 'ATTENTION_REQUIRED'
  else if (Number(count.blocking_held_count) > 0) status = 'HELD'
  else if (Number(count.running_count) > 0) status = 'RUNNING'
  else if (Number(count.retry_count) > 0) status = 'RETRYING'
  else if (Number(count.incomplete_count) === 0) {
    let hasRestrictedRetention = false
    if (parent.request_id) {
      const [holds] = await connection.query<any[]>(
        `SELECT COUNT(*) AS hold_count
           FROM data_retention_holds
          WHERE scope_type='USER_REQUEST' AND scope_id=?
            AND released_at IS NULL AND expires_at>NOW()`,
        [parent.request_id],
      )
      hasRestrictedRetention = Number(holds[0]?.hold_count || 0) > 0
    }
    status = hasRestrictedRetention ? 'COMPLETED_WITH_RESTRICTED_RETENTION' : 'COMPLETED'
  }
  if (parent.request_id) {
    await connection.query(
      `UPDATE account_deletion_requests
          SET execution_status=?, status=IF(? IN ('COMPLETED','COMPLETED_WITH_RESTRICTED_RETENTION'), 'COMPLETED', status),
              started_at=IF(?='RUNNING', COALESCE(started_at, NOW()), started_at),
              completed_at=IF(? IN ('COMPLETED','COMPLETED_WITH_RESTRICTED_RETENTION'), COALESCE(completed_at, NOW()), completed_at)
        WHERE request_id=?`,
      [status, status, status, status, parent.request_id],
    )
  } else {
    await connection.query(
      `UPDATE data_retention_scan_runs
          SET status=?, started_at=IF(?='RUNNING', COALESCE(started_at, NOW()), started_at),
              completed_at=IF(?='COMPLETED', COALESCE(completed_at, NOW()), completed_at), updated_at=NOW()
        WHERE scan_run_id=?`,
      [status, status, status, parent.scan_run_id],
    )
  }
}

export class LifecycleWorkerRepository implements LifecycleWorkerRepositoryContract {
  constructor(private readonly database: LifecycleWorkerDatabase = pool as unknown as LifecycleWorkerDatabase) {}

  async releaseExpiredLeases(now: Date, dataRegion?: DataRegion): Promise<number> {
    await this.database.query(
      `UPDATE data_lifecycle_steps s
       LEFT JOIN account_deletion_requests adr ON adr.request_id=s.request_id
       LEFT JOIN data_retention_scan_runs scan ON scan.scan_run_id=s.scan_run_id
          SET s.status='PENDING',s.next_attempt_at=NULL,s.updated_at=NOW()
        WHERE s.status='HELD' AND (? IS NULL OR COALESCE(adr.data_region,scan.data_region)=?)
          AND NOT EXISTS (
            SELECT 1 FROM data_retention_holds h
             WHERE h.data_region=COALESCE(adr.data_region,scan.data_region)
               AND h.category_code=s.category_code AND h.released_at IS NULL AND h.expires_at>?
               AND ((h.scope_type='USER_REQUEST' AND h.scope_id=s.request_id)
                 OR (h.scope_type='RETENTION_SCAN' AND h.scope_id=s.scan_run_id))
          )`,
      [dataRegion ?? null,dataRegion ?? null,now],
    )
    await this.database.query(
      `UPDATE data_lifecycle_steps s
       LEFT JOIN account_deletion_requests adr ON adr.request_id=s.request_id
       LEFT JOIN data_retention_scan_runs scan ON scan.scan_run_id=s.scan_run_id
       JOIN data_retention_holds h ON h.data_region=COALESCE(adr.data_region,scan.data_region)
        AND h.category_code=s.category_code AND h.released_at IS NULL AND h.expires_at>?
        AND ((h.scope_type='USER_REQUEST' AND h.scope_id=s.request_id)
          OR (h.scope_type='RETENTION_SCAN' AND h.scope_id=s.scan_run_id))
          SET s.status='HELD',s.lease_owner=NULL,s.lease_expires_at=NULL,s.updated_at=NOW()
        WHERE s.status IN ('PENDING','RETRYING')
          AND (? IS NULL OR COALESCE(adr.data_region,scan.data_region)=?)`,
      [now,dataRegion ?? null,dataRegion ?? null],
    )
    const params: unknown[] = [now]
    const regionClause = dataRegion
      ? 'AND COALESCE(adr.data_region, scan.data_region)=?'
      : ''
    if (dataRegion) params.push(dataRegion)
    const [result] = await this.database.query<any>(
      `UPDATE data_lifecycle_steps dls
       LEFT JOIN account_deletion_requests adr ON adr.request_id=dls.request_id
       LEFT JOIN data_retention_scan_runs scan ON scan.scan_run_id=dls.scan_run_id
          SET dls.status='RETRYING', dls.lease_owner=NULL, dls.lease_expires_at=NULL,
              dls.next_attempt_at=?, dls.updated_at=NOW()
        WHERE dls.status='RUNNING' AND dls.lease_expires_at IS NOT NULL
          AND dls.lease_expires_at <= ? ${regionClause}`,
      [now, ...params],
    )
    return Number(result.affectedRows || 0)
  }

  async isRegionPaused(dataRegion: DataRegion): Promise<boolean> {
    const [rows] = await this.database.query<any[]>(
      'SELECT paused FROM data_lifecycle_controls WHERE data_region=? LIMIT 1',
      [dataRegion],
    )
    return Boolean(rows[0]?.paused)
  }

  async claimNextStep(
    workerId: string,
    now: Date,
    leaseMs: number,
    dataRegion?: DataRegion,
  ): Promise<ClaimedLifecycleStep | null> {
    if (!Number.isInteger(leaseMs) || leaseMs < 5_000 || leaseMs > 10 * 60_000) {
      throw Object.assign(new Error('生命周期租约时长无效'), { code: 'LIFECYCLE_LEASE_CONFIG_INVALID' })
    }
    const connection = await this.database.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query<any[]>(
        `SELECT step.*, adr.user_id, adr.data_region AS request_region,
                adr.policy_snapshot_json, scan.data_region AS scan_region,
                scan.window_start, scan.window_end
           FROM data_lifecycle_steps step
           LEFT JOIN account_deletion_requests adr ON adr.request_id=step.request_id
           LEFT JOIN data_retention_scan_runs scan ON scan.scan_run_id=step.scan_run_id
          WHERE step.status IN ('PENDING', 'RETRYING')
            AND (step.next_attempt_at IS NULL OR step.next_attempt_at <= ?)
            AND (step.lease_expires_at IS NULL OR step.lease_expires_at <= ?)
            AND (? IS NULL OR COALESCE(adr.data_region, scan.data_region)=?)
          ORDER BY step.created_at, step.id
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        [now, now, dataRegion ?? null, dataRegion ?? null],
      )
      const row = rows[0]
      if (!row) {
        await connection.commit()
        return null
      }
      const leaseExpiresAt = new Date(now.getTime() + leaseMs)
      const [result] = await connection.query<any>(
        `UPDATE data_lifecycle_steps
            SET lease_owner=?, lease_expires_at=?, status='RUNNING',
                started_at=COALESCE(started_at, ?), updated_at=?
          WHERE step_id=? AND status IN ('PENDING','RETRYING')`,
        [workerId, leaseExpiresAt, now, now, row.step_id],
      )
      if (Number(result.affectedRows) !== 1) {
        throw Object.assign(new Error('生命周期步骤认领冲突'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
      }
      await syncParentStatus(connection, row)
      await connection.commit()

      const region = String(row.request_region ?? row.scan_region) as DataRegion
      const parent: LifecycleParentContext = row.request_id
        ? { kind: 'ACCOUNT_DELETION', requestId: String(row.request_id), userId: row.user_id == null ? null : Number(row.user_id) }
        : {
            kind: 'RETENTION_SCAN',
            scanRunId: String(row.scan_run_id),
            windowStart: asDate(row.window_start),
            windowEnd: asDate(row.window_end),
          }
      return {
        stepId: String(row.step_id),
        stepCode: String(row.step_code),
        category: String(row.category_code) as LifecycleCategoryCode,
        action: String(row.action) as RetentionAction,
        dataRegion: region,
        parent,
        policySnapshot: parseJson<LifecyclePolicySnapshot | null>(row.policy_snapshot_json, null),
        cursor: parseJson<LifecycleCursor | null>(row.cursor_json, null),
        plannedCount: Number(row.planned_count || 0),
        processedCount: Number(row.processed_count || 0),
        attemptCount: Number(row.attempt_count || 0),
        status: 'RUNNING',
      }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async completeBatch(workerId: string, completion: LifecycleBatchCompletion): Promise<void> {
    const connection = await this.database.getConnection()
    try {
      await connection.beginTransaction()
      const row = await assertOwnedStep(connection, completion.stepId, workerId)
      const previousCursor = parseJson<LifecycleCursor | null>(row.cursor_json, null)
      compareCursor(previousCursor, completion.nextCursor)
      const status: LifecycleStepStatus = completion.done ? 'COMPLETED' : 'PENDING'
      await connection.query(
        `UPDATE data_lifecycle_steps
            SET cursor_json=?, planned_count=GREATEST(planned_count, ?),
                processed_count=processed_count + ?, status=?, completed_at=?,
                lease_owner=NULL, lease_expires_at=NULL, next_attempt_at=NULL,
                last_error_code=NULL, updated_at=NOW()
          WHERE step_id=? AND lease_owner=?`,
        [
          completion.nextCursor ? JSON.stringify(completion.nextCursor) : null,
          Math.max(0, Number(completion.plannedCount || 0)),
          Math.max(0, Number(completion.processedCount || 0)),
          status,
          completion.done ? new Date() : null,
          completion.stepId,
          workerId,
        ],
      )
      await syncParentStatus(connection, row)
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async renewLease(workerId: string, stepId: string, now: Date, leaseMs: number): Promise<void> {
    const leaseExpiresAt = new Date(now.getTime() + leaseMs)
    const [result] = await this.database.query<any>(
      `UPDATE data_lifecycle_steps
          SET lease_expires_at=?, updated_at=NOW()
        WHERE step_id=? AND lease_owner=? AND status='RUNNING' AND lease_expires_at>?`,
      [leaseExpiresAt, stepId, workerId, now],
    )
    if (Number(result.affectedRows) !== 1) {
      throw Object.assign(new Error('生命周期步骤租约已失效'), { code: 'LIFECYCLE_LEASE_CONFLICT' })
    }
  }

  async markRetry(
    workerId: string,
    input: { stepId: string; errorCode: string; now: Date; maxAttempts: number },
  ): Promise<'RETRYING' | 'ATTENTION_REQUIRED'> {
    const connection = await this.database.getConnection()
    try {
      await connection.beginTransaction()
      const row = await assertOwnedStep(connection, input.stepId, workerId)
      const attemptCount = Number(row.attempt_count || 0) + 1
      const exhausted = attemptCount >= input.maxAttempts
      const status = exhausted ? 'ATTENTION_REQUIRED' : 'RETRYING'
      const nextAttemptAt = exhausted
        ? null
        : new Date(input.now.getTime() + Math.min(60 * 60_000, 1_000 * 2 ** Math.max(0, attemptCount - 1)))
      await connection.query(
        `UPDATE data_lifecycle_steps
            SET attempt_count=?, status=?, next_attempt_at=?, last_error_code=?,
                lease_owner=NULL, lease_expires_at=NULL, updated_at=NOW()
          WHERE step_id=? AND lease_owner=?`,
        [
          attemptCount,
          status,
          nextAttemptAt,
          exhausted ? 'LIFECYCLE_STEP_RETRY_EXHAUSTED' : input.errorCode,
          input.stepId,
          workerId,
        ],
      )
      await syncParentStatus(connection, row)
      await connection.commit()
      return status
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async markAttention(workerId: string, stepId: string, errorCode: string): Promise<void> {
    const connection = await this.database.getConnection()
    try {
      await connection.beginTransaction()
      const row = await assertOwnedStep(connection, stepId, workerId)
      await connection.query(
        `UPDATE data_lifecycle_steps
            SET status='ATTENTION_REQUIRED', last_error_code=?, lease_owner=NULL,
                lease_expires_at=NULL, next_attempt_at=NULL, updated_at=NOW()
          WHERE step_id=? AND lease_owner=?`,
        [errorCode, stepId, workerId],
      )
      await syncParentStatus(connection, row)
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}
