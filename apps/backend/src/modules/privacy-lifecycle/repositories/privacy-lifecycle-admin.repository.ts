import HttpError from '@/common/errors/http-error'
import { pool } from '@/config/database'
import type { DataRegion } from '../domain/lifecycle.model'
import type {
  LifecycleAdminOperation,
  LifecycleAdminOperationType,
  PrivacyLifecycleAdminRepositoryContract,
} from '../services/privacy-lifecycle-admin.service'

const db = pool as any

type AdminOperationInput = LifecycleAdminOperation & {
  dataRegion: DataRegion
  operationType: LifecycleAdminOperationType
  actorId: number
}

const parseJson = (value: unknown): any => {
  if (value == null || typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    throw new HttpError('管理操作回执损坏', 500, { code: 'LIFECYCLE_OPERATION_RESULT_INVALID' })
  }
}

const replayOperation = (row: any, input: AdminOperationInput): any => {
  if (
    String(row.data_region) !== input.dataRegion ||
    String(row.operation_type) !== input.operationType ||
    String(row.request_digest) !== input.requestDigest
  ) {
    throw new HttpError('操作编号已用于不同请求', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
  }
  return parseJson(row.result_json)
}

async function runIdempotentOperation<T>(
  input: AdminOperationInput,
  execute: (connection: any) => Promise<T>,
): Promise<T> {
  const connection = await db.getConnection()
  try {
    await connection.beginTransaction()
    const [existingRows] = await connection.query(
      `SELECT data_region,operation_type,request_digest,result_json
         FROM data_lifecycle_admin_operations
        WHERE operation_id=?
        LIMIT 1 FOR UPDATE`,
      [input.operationId],
    )
    if (existingRows?.[0]) {
      const result = replayOperation(existingRows[0], input)
      await connection.commit()
      return result as T
    }

    await connection.query(
      `INSERT INTO data_lifecycle_admin_operations
        (operation_id,data_region,operation_type,request_digest,result_json,actor_user_id)
       VALUES (?,?,?,?,NULL,?)`,
      [input.operationId, input.dataRegion, input.operationType, input.requestDigest, input.actorId],
    )
    const result = await execute(connection)
    await connection.query(
      `UPDATE data_lifecycle_admin_operations
          SET result_json=?,completed_at=NOW()
        WHERE operation_id=?`,
      [JSON.stringify(result), input.operationId],
    )
    await connection.commit()
    return result
  } catch (error: any) {
    await connection.rollback()
    if (error?.code === 'ER_DUP_ENTRY') {
      const [rows] = await db.query(
        `SELECT data_region,operation_type,request_digest,result_json
           FROM data_lifecycle_admin_operations
          WHERE operation_id=?
          LIMIT 1`,
        [input.operationId],
      )
      if (rows?.[0]) return replayOperation(rows[0], input) as T
    }
    throw error
  } finally {
    connection.release()
  }
}

const operationInput = (
  dataRegion: DataRegion,
  operationType: AdminOperationInput['operationType'],
  operation: LifecycleAdminOperation,
  actorId: number,
): AdminOperationInput => ({ dataRegion, operationType, actorId, ...operation })

const restrictedRetentionSelect = `
  (SELECT MAX(h.expires_at)
     FROM data_retention_holds h
    WHERE h.data_region=adr.data_region
      AND h.scope_type='USER_REQUEST'
      AND h.scope_id=adr.request_id
      AND h.released_at IS NULL
      AND h.expires_at>NOW()) AS restricted_retention_until`

export const PrivacyLifecycleAdminRepository: PrivacyLifecycleAdminRepositoryContract = {
  async findHoldReplay(dataRegion, holdId, requestDigest) {
    const [rows] = await db.query(
      `SELECT hold_id,data_region,category_code,scope_type,scope_id,reason_code,
              request_digest,expires_at,released_at
         FROM data_retention_holds
        WHERE hold_id=?
        LIMIT 1`,
      [holdId],
    )
    const row = rows?.[0]
    if (!row) return { found: false, result: null }
    if (String(row.data_region) !== dataRegion || String(row.request_digest) !== requestDigest) {
      throw new HttpError('冻结编号已用于不同请求', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
    }
    return {
      found: true,
      result: {
        holdId: String(row.hold_id),
        dataRegion: String(row.data_region),
        category: String(row.category_code),
        scopeType: String(row.scope_type),
        scopeId: String(row.scope_id),
        reasonCode: String(row.reason_code),
        expiresAt: new Date(row.expires_at).toISOString(),
        releasedAt: row.released_at ? new Date(row.released_at).toISOString() : null,
      },
    }
  },

  async findOperationReplay(dataRegion, operationType, operation) {
    const input = operationInput(dataRegion, operationType, operation, 0)
    const [rows] = await db.query(
      `SELECT data_region,operation_type,request_digest,result_json
         FROM data_lifecycle_admin_operations
        WHERE operation_id=?
        LIMIT 1`,
      [operation.operationId],
    )
    if (!rows?.[0]) return { found: false, result: null }
    return { found: true, result: replayOperation(rows[0], input) }
  },

  async createHold(input) {
    try {
      await db.query(
        `INSERT INTO data_retention_holds
          (hold_id,data_region,category_code,scope_type,scope_id,reason_code,
           legal_basis_reference,request_digest,expires_at,created_by,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          input.holdId,
          input.dataRegion,
          input.category,
          input.scopeType,
          input.scopeId,
          input.reasonCode,
          input.legalBasisReference,
          input.requestDigest,
          input.expiresAt,
          input.createdBy,
          input.createdAt,
        ],
      )
    } catch (error: any) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error
      const [existing] = await db.query(
        'SELECT hold_id,request_digest FROM data_retention_holds WHERE hold_id=? AND data_region=? LIMIT 1',
        [input.holdId, input.dataRegion],
      )
      if (String(existing[0]?.request_digest) !== input.requestDigest) {
        throw new HttpError('冻结编号已用于不同请求', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
      }
    }
    return {
      holdId: input.holdId,
      dataRegion: input.dataRegion,
      category: input.category,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      reasonCode: input.reasonCode,
      expiresAt: new Date(input.expiresAt).toISOString(),
      releasedAt: null,
    }
  },

  async releaseHold(dataRegion, holdId, operation, actorId, now) {
    return runIdempotentOperation(
      operationInput(dataRegion, 'RELEASE_HOLD', operation, actorId),
      async connection => {
        const [result] = await connection.query(
          `UPDATE data_retention_holds
              SET released_by=?,released_at=?,updated_at=?
            WHERE hold_id=? AND data_region=? AND released_at IS NULL`,
          [actorId, now, now, holdId, dataRegion],
        )
        return result.affectedRows ? { holdId, releasedAt: now.toISOString() } : null
      },
    )
  },

  async extendHold(dataRegion, holdId, operation, expiresAt, actorId, now) {
    return runIdempotentOperation(
      operationInput(dataRegion, 'EXTEND_HOLD', operation, actorId),
      async connection => {
        const [result] = await connection.query(
          `UPDATE data_retention_holds
              SET expires_at=?,updated_at=?
            WHERE hold_id=? AND data_region=? AND released_at IS NULL`,
          [expiresAt, now, holdId, dataRegion],
        )
        return result.affectedRows ? { holdId, expiresAt: expiresAt.toISOString() } : null
      },
    )
  },

  async pauseRegion(dataRegion, operation, reason, reviewAt, actorId) {
    return runIdempotentOperation(
      operationInput(dataRegion, 'PAUSE_REGION', operation, actorId),
      async connection => {
        await connection.query(
          `INSERT INTO data_lifecycle_controls(data_region,paused,pause_reason,review_at,updated_by)
           VALUES (?,1,?,?,?)
           ON DUPLICATE KEY UPDATE paused=1,pause_reason=VALUES(pause_reason),review_at=VALUES(review_at),
             updated_by=VALUES(updated_by),updated_at=NOW()`,
          [dataRegion, reason, reviewAt, actorId],
        )
        return { paused: true, reviewAt: reviewAt.toISOString() }
      },
    )
  },

  async resumeRegion(dataRegion, operation, actorId) {
    return runIdempotentOperation(
      operationInput(dataRegion, 'RESUME_REGION', operation, actorId),
      async connection => {
        await connection.query(
          `INSERT INTO data_lifecycle_controls(data_region,paused,updated_by)
           VALUES (?,0,?)
           ON DUPLICATE KEY UPDATE paused=0,pause_reason=NULL,review_at=NULL,
             updated_by=VALUES(updated_by),updated_at=NOW()`,
          [dataRegion, actorId],
        )
        return { paused: false }
      },
    )
  },

  async retryStep(dataRegion, stepId, operation, now, actorId) {
    return runIdempotentOperation(
      operationInput(dataRegion, 'RETRY_STEP', operation, actorId),
      async connection => {
        const [result] = await connection.query(
          `UPDATE data_lifecycle_steps s
             LEFT JOIN account_deletion_requests r ON r.request_id=s.request_id
             LEFT JOIN data_retention_scan_runs q ON q.scan_run_id=s.scan_run_id
              SET s.status='PENDING',s.attempt_count=0,s.next_attempt_at=?,s.last_error_code=NULL,
                  s.lease_owner=NULL,s.lease_expires_at=NULL
            WHERE s.step_id=?
              AND COALESCE(r.data_region,q.data_region)=?
              AND s.status IN ('ATTENTION_REQUIRED','RETRYING')`,
          [now, stepId, dataRegion],
        )
        return Number(result.affectedRows) > 0 ? { stepId, status: 'PENDING' } : null
      },
    )
  },

  async listRequests(dataRegion, input = {}) {
    const limit = Math.max(1, Math.min(100, Number(input.limit) || 20))
    const offset = Math.max(0, Number(input.offset) || 0)
    const [rows] = await db.query(
      `SELECT adr.request_id,adr.deletion_mode,adr.execution_status,adr.requested_at,
              adr.scheduled_for,adr.started_at,adr.completed_at,
              ${restrictedRetentionSelect}
         FROM account_deletion_requests adr
        WHERE adr.data_region=?
        ORDER BY adr.requested_at DESC
        LIMIT ? OFFSET ?`,
      [dataRegion, limit, offset],
    )
    return { items: rows, limit, offset }
  },

  async getRequest(dataRegion, requestId) {
    const [rows] = await db.query(
      `SELECT adr.request_id,adr.deletion_mode,adr.execution_status,adr.requested_at,
              adr.scheduled_for,adr.started_at,adr.completed_at,
              ${restrictedRetentionSelect}
         FROM account_deletion_requests adr
        WHERE adr.request_id=? AND adr.data_region=?
        LIMIT 1`,
      [requestId, dataRegion],
    )
    if (!rows[0]) return null
    const [steps] = await db.query(
      `SELECT step_id,step_code,category_code,action,status,planned_count,processed_count,
              attempt_count,last_error_code,lease_expires_at
         FROM data_lifecycle_steps
        WHERE request_id=?
        ORDER BY id`,
      [requestId],
    )
    return { ...rows[0], steps }
  },

  async getDryRunContext(dataRegion, requestId) {
    const [rows] = await db.query(
      `SELECT user_id,policy_snapshot_json
         FROM account_deletion_requests
        WHERE request_id=? AND data_region=?
        LIMIT 1`,
      [requestId, dataRegion],
    )
    if (!rows[0] || rows[0].user_id == null) return null
    let policySnapshot = null
    try {
      policySnapshot = typeof rows[0].policy_snapshot_json === 'string'
        ? JSON.parse(rows[0].policy_snapshot_json)
        : rows[0].policy_snapshot_json
    } catch {}
    return { userId: Number(rows[0].user_id), policySnapshot }
  },
}
