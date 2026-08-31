import { randomUUID } from 'node:crypto'

import { pool } from '@/config/database'
import HttpError from '@/common/errors/http-error'
import { UserRepository } from '@/modules/auth/repositories/user.repository'
import {
  resolveLifecyclePolicy,
  type LifecyclePolicySnapshot,
  type LifecycleStatus,
  type LifecycleStepStatus,
  type RetentionAction,
} from '@/modules/privacy-lifecycle/domain/lifecycle.policy'
import type {
  AccountDeletionRecord,
  AccountDeletionRepositoryContract,
  AccountDeletionStepProjection,
  AccountDeletionUser,
  CreateDeletionRequestInput,
  CreateDeletionRequestResult,
} from '../domain/account-deletion.model'
import { encryptOutboxValue, parseOutboxKeyring } from '@/modules/privacy-lifecycle/domain/outbox-crypto'

const stageOutbox = async (connection: any,input:{messageKey:string;requestId:string;dataRegion:string;messageType:string;email:string;payload:unknown;now:Date})=>{
  const key=parseOutboxKeyring(process.env).v1
  await connection.query(`INSERT INTO transactional_outbox(message_id,message_key,request_id,data_region,message_type,status,recipient_envelope_json,payload_envelope_json,expires_at) VALUES (?,?,?,?,?,'PENDING',?,?,?)`,[
    randomUUID(),input.messageKey,input.requestId,input.dataRegion,input.messageType,
    JSON.stringify(encryptOutboxValue(key,input.email)),JSON.stringify(encryptOutboxValue(key,JSON.stringify(input.payload))),new Date(input.now.getTime()+7*86400000),
  ])
}

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback
  if (typeof value === 'object') return value as T
  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}

const asIso = (value: unknown): string | null => {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const mapUser = (user: any): AccountDeletionUser | null => {
  if (!user) return null
  return {
    id: Number(user.id),
    email: String(user.email || '').trim().toLowerCase(),
    passwordHash: String(user.password || ''),
    dataRegion: user.data_region === 'CN' || user.data_region === 'GLOBAL' ? user.data_region : undefined,
    accountType: user.account_type === 'INSTITUTION' ? 'INSTITUTION' : 'PERSONAL',
    deletionStatus: String(user.deletion_status || 'ACTIVE'),
  }
}

const normalizeStatus = (value: unknown): LifecycleStatus => {
  const status = String(value || '').toUpperCase()
  const supported = new Set<LifecycleStatus>([
    'REQUESTED',
    'SCHEDULED',
    'RUNNING',
    'HELD',
    'RETRYING',
    'ATTENTION_REQUIRED',
    'COMPLETED',
    'COMPLETED_WITH_RESTRICTED_RETENTION',
    'CANCELLED',
  ])
  if (supported.has(status as LifecycleStatus)) return status as LifecycleStatus
  return status === 'PENDING' ? 'SCHEDULED' : 'ATTENTION_REQUIRED'
}

const db = pool as any

async function readSteps(requestId: string): Promise<AccountDeletionStepProjection[]> {
  const [rows] = await db.query(
    `SELECT step_code, category_code, action, status, planned_count, processed_count,
            attempt_count, last_error_code
       FROM data_lifecycle_steps
      WHERE request_id=?
      ORDER BY id ASC`,
    [requestId],
  )
  return (rows as any[]).map(row => ({
    stepCode: String(row.step_code),
    category: String(row.category_code) as AccountDeletionStepProjection['category'],
    action: String(row.action) as RetentionAction,
    status: String(row.status) as LifecycleStepStatus,
    plannedCount: Number(row.planned_count || 0),
    processedCount: Number(row.processed_count || 0),
    attemptCount: Number(row.attempt_count || 0),
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
  }))
}

async function mapRecord(row: any): Promise<AccountDeletionRecord | null> {
  if (!row) return null
  const requestedAt = asIso(row.requested_at) ?? new Date(0).toISOString()
  const dataRegion = row.data_region === 'GLOBAL' ? 'GLOBAL' : 'CN'
  const fallbackPolicy = resolveLifecyclePolicy({
    dataRegion,
    accountType: 'PERSONAL',
    createdAt: new Date(requestedAt),
  })
  return {
    requestId: String(row.request_id),
    userId: row.user_id == null ? null : Number(row.user_id),
    dataRegion,
    mode: row.deletion_mode === 'IMMEDIATE' ? 'IMMEDIATE' : 'GRACE_PERIOD',
    status: normalizeStatus(row.execution_status ?? row.status),
    requestDigest: String(row.request_digest || ''),
    policyVersion: String(row.policy_version || fallbackPolicy.version),
    policySnapshot: parseJson<LifecyclePolicySnapshot>(row.policy_snapshot_json, fallbackPolicy),
    statusTokenDigest: String(row.status_token_digest || ''),
    retentionSummary: parseJson(row.retention_summary_json, null),
    requestedAt,
    scheduledFor: asIso(row.scheduled_for) ?? requestedAt,
    startedAt: asIso(row.started_at),
    cancelledAt: asIso(row.cancelled_at),
    completedAt: asIso(row.completed_at),
    restrictedRetentionUntil: asIso(row.restricted_retention_until),
    steps: await readSteps(String(row.request_id)),
  }
}

async function findRecord(
  whereSql: string,
  params: unknown[],
  orderSql = '',
): Promise<AccountDeletionRecord | null> {
  const [rows] = await db.query(
    `SELECT adr.*,
            (SELECT MAX(h.expires_at)
               FROM data_retention_holds h
              WHERE h.data_region=adr.data_region
                AND h.scope_type='USER_REQUEST'
                AND h.scope_id=adr.request_id
                AND h.released_at IS NULL
                AND h.expires_at > NOW()) AS restricted_retention_until
       FROM account_deletion_requests adr
      WHERE ${whereSql}
      ${orderSql}
      LIMIT 1`,
    params,
  )
  return mapRecord(rows?.[0])
}

export const AccountDeletionRepository: AccountDeletionRepositoryContract = {
  async findUserForReauthentication(userId: number): Promise<AccountDeletionUser | null> {
    return mapUser(await UserRepository.findById(userId))
  },

  async findUserByEmailForReauthentication(email: string): Promise<AccountDeletionUser | null> {
    return mapUser(await UserRepository.findByEmail(email))
  },

  async createOrReplay(input: CreateDeletionRequestInput): Promise<CreateDeletionRequestResult> {
    const connection = await db.getConnection()
    let revokedSessionIds: string[] = []
    let replayed = false
    try {
      await connection.beginTransaction()
      const [existingRows] = await connection.query(
        `SELECT request_digest
           FROM account_deletion_requests
          WHERE request_id=?
          LIMIT 1 FOR UPDATE`,
        [input.requestId],
      )
      const existing = existingRows?.[0]
      if (existing) {
        if (String(existing.request_digest || '') !== input.requestDigest) {
          throw new HttpError('请求编号已用于不同注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
        }
        replayed = true
        await connection.commit()
      } else {
        const [userRows] = await connection.query(
          `SELECT id, deletion_status FROM users WHERE id=? LIMIT 1 FOR UPDATE`,
          [input.userId],
        )
        const user = userRows?.[0]
        if (!user) throw new HttpError('用户不存在', 404, { code: 'NOT_FOUND' })
        if (!['ACTIVE', 'CANCELLED'].includes(String(user.deletion_status || 'ACTIVE'))) {
          throw new HttpError('账号已有进行中的注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
        }
        const [activeRows] = await connection.query(
          `SELECT request_id
             FROM account_deletion_requests
            WHERE user_id=?
              AND execution_status NOT IN ('CANCELLED', 'COMPLETED', 'COMPLETED_WITH_RESTRICTED_RETENTION')
            ORDER BY id DESC
            LIMIT 1 FOR UPDATE`,
          [input.userId],
        )
        if (activeRows?.[0]) {
          throw new HttpError('账号已有进行中的注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
        }

        await connection.query(
          `INSERT INTO account_deletion_requests
            (request_id, user_id, data_region, status, confirmation_phrase,
             retention_summary_json, reauthenticated_at, requested_at, scheduled_for,
             deletion_mode, execution_status, request_digest, policy_version,
             policy_snapshot_json, status_token_digest)
           VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, ?, ?)`,
          [
            input.requestId,
            input.userId,
            input.dataRegion,
            input.confirmationPhrase,
            JSON.stringify(input.retentionSummary),
            input.now,
            input.now,
            input.scheduledFor,
            input.mode,
            input.requestDigest,
            input.policySnapshot.version,
            JSON.stringify(input.policySnapshot),
            input.statusTokenDigest,
          ],
        )
        for (const step of input.steps) {
          await connection.query(
            `INSERT INTO data_lifecycle_steps
              (step_id, request_id, step_code, category_code, action, status)
             VALUES (?, ?, ?, ?, ?, 'PENDING')`,
            [randomUUID(), input.requestId, step.stepCode, step.category, step.action],
          )
        }
        await stageOutbox(connection,{messageKey:`deletion-requested:${input.requestId}`,requestId:input.requestId,dataRegion:input.dataRegion,messageType:'DELETION_REQUESTED',email:input.notificationEmail,payload:{status:'SCHEDULED',scheduledFor:input.scheduledFor.toISOString()},now:input.now})

        const [sessions] = await connection.query(
          `SELECT jti FROM refresh_tokens WHERE user_id=? AND revoked=0 FOR UPDATE`,
          [input.userId],
        )
        revokedSessionIds = (sessions as Array<{ jti: string }>)
          .map(session => String(session.jti || ''))
          .filter(Boolean)
        await connection.query('UPDATE refresh_tokens SET revoked=1 WHERE user_id=? AND revoked=0', [input.userId])
        await connection.query("UPDATE users SET deletion_status='SCHEDULED' WHERE id=?", [input.userId])
        await connection.commit()
      }
    } catch (error: any) {
      await connection.rollback()
      if (error?.code === 'ER_DUP_ENTRY') {
        const duplicate = await findRecord('adr.request_id=?', [input.requestId])
        if (duplicate?.requestDigest === input.requestDigest) {
          return { record: duplicate, replayed: true, revokedSessionIds: [] }
        }
        throw new HttpError('请求编号已用于不同注销申请', 409, { code: 'LIFECYCLE_REQUEST_CONFLICT' })
      }
      throw error
    } finally {
      connection.release()
    }

    const record = await this.findByStatusCredential(input.requestId)
    if (!record) throw new HttpError('注销申请创建后无法读取', 500, { code: 'LIFECYCLE_REQUEST_READ_FAILED' })
    return { record, replayed, revokedSessionIds }
  },

  async findByStatusCredential(requestId: string): Promise<AccountDeletionRecord | null> {
    return findRecord('adr.request_id=?', [requestId])
  },

  async findLatestByUser(userId: number): Promise<AccountDeletionRecord | null> {
    return findRecord('adr.user_id=?', [userId], 'ORDER BY adr.id DESC')
  },

  async cancelGraceRequest(userId: number, now: Date): Promise<AccountDeletionRecord> {
    const connection = await db.getConnection()
    let requestId = ''
    try {
      await connection.beginTransaction()
      const [rows] = await connection.query(
        `SELECT adr.request_id, adr.data_region, adr.deletion_mode, adr.execution_status, adr.started_at, u.email
           FROM account_deletion_requests adr JOIN users u ON u.id=adr.user_id
          WHERE adr.user_id=?
          ORDER BY adr.id DESC
          LIMIT 1 FOR UPDATE`,
        [userId],
      )
      const record = rows?.[0]
      if (!record) throw new HttpError('没有可取消的注销申请', 404, { code: 'NOT_FOUND' })
      requestId = String(record.request_id)
      if (
        record.deletion_mode !== 'GRACE_PERIOD' ||
        record.started_at != null ||
        !['REQUESTED', 'SCHEDULED'].includes(String(record.execution_status))
      ) {
        throw new HttpError('注销申请已进入不可逆阶段', 409, { code: 'LIFECYCLE_ALREADY_IRREVERSIBLE' })
      }

      await connection.query(
        `UPDATE account_deletion_requests
            SET status='CANCELLED', execution_status='CANCELLED', cancelled_at=?,
                confirmation_phrase=NULL, reauthenticated_at=NULL, last_error_code=NULL
          WHERE request_id=?`,
        [now, requestId],
      )
      await connection.query('DELETE FROM data_lifecycle_steps WHERE request_id=?', [requestId])
      await connection.query("UPDATE users SET deletion_status='ACTIVE' WHERE id=?", [userId])
      await stageOutbox(connection,{messageKey:`deletion-cancelled:${requestId}`,requestId,dataRegion:String(record.data_region),messageType:'DELETION_CANCELLED',email:String(record.email),payload:{status:'CANCELLED',completedAt:now.toISOString()},now})
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    const record = await this.findByStatusCredential(requestId)
    if (!record) throw new HttpError('注销取消后无法读取状态', 500, { code: 'LIFECYCLE_REQUEST_READ_FAILED' })
    return record
  },
}
