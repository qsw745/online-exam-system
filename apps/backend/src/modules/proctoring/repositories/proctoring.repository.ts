import { pool } from '@/config/database'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  ProctoringAttemptContext,
  ProctoringConsent,
  ProctoringEvent,
  ProctoringIdentityCheck,
  ProctoringSession,
  ProctoringSeverity,
  ProctoringSummary,
  StoredProctoringEvent,
} from '../domain/proctoring.model.js'
import {
  normalizeProctoringPolicy,
  type NormalizedFactualEvent,
  type ProctoringSessionState,
} from '../domain/proctoring.policy.js'
import { ensureReviewCaseInTransaction } from './proctoring-review.repository.js'

type ListParams = {
  examId: number
  userId?: number
  severity?: ProctoringSeverity
  page?: number
  limit?: number
}

const asIso = (value: unknown): string | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const parseJson = <T>(raw: unknown, fallback: T): T => {
  if (raw == null) return fallback
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return fallback
  }
}

const toRegion = (value: unknown): 'cn' | 'global' =>
  String(value || '').toUpperCase() === 'GLOBAL' ? 'global' : 'cn'

const toConsent = (row: any): ProctoringConsent => ({
  consentId: String(row.consent_id),
  attemptId: String(row.attempt_id),
  examId: Number(row.exam_id),
  userId: Number(row.user_id),
  dataRegion: toRegion(row.data_region),
  policyVersion: String(row.policy_version),
  noticeVersion: String(row.notice_version),
  policyDigest: String(row.policy_digest),
  categories: parseJson<string[]>(row.categories_json, []),
  acceptedAt: asIso(row.accepted_at) || new Date(0).toISOString(),
  revokedAt: asIso(row.revoked_at),
  expiresAt: asIso(row.expires_at) || new Date(0).toISOString(),
})

const toSession = (row: any): ProctoringSession => ({
  sessionId: String(row.session_id),
  consentId: String(row.consent_id),
  attemptId: String(row.attempt_id),
  examId: Number(row.exam_id),
  taskId: row.task_id == null ? null : Number(row.task_id),
  userId: Number(row.user_id),
  dataRegion: toRegion(row.data_region),
  state: String(row.state) as ProctoringSessionState,
  lastSequence: Number(row.last_sequence || 0),
  cameraRequired: Boolean(row.camera_required),
  microphoneRequired: Boolean(row.microphone_required),
  identityRequired: Boolean(row.identity_required),
  identityStatus: String(row.identity_status) as ProctoringSession['identityStatus'],
  startedAt: asIso(row.started_at),
  lastHeartbeatAt: asIso(row.last_heartbeat_at),
  interruptionStartedAt: asIso(row.interruption_started_at),
  completedAt: asIso(row.completed_at),
  reviewReasonCode: row.review_reason_code ? String(row.review_reason_code) : null,
})

const selectSession = async (connection: PoolConnection, sessionId: string, userId: number, lock = false) => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT * FROM proctoring_sessions WHERE session_id = ? AND user_id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [sessionId, userId],
  )
  return rows[0] ? toSession(rows[0]) : null
}

export const ProctoringRepository = {
  async getAttemptContext(attemptId: string, examId: number, userId: number): Promise<ProctoringAttemptContext | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT er.attempt_id, er.exam_id, er.user_id, er.status AS result_status,
              u.data_region, u.age_band,
              e.end_time AS exam_ends_at,
              e.proctoring_level,
              e.proctoring_policy_version,
              e.proctoring_notice_version,
              e.proctoring_require_identity,
              e.proctoring_allow_minors,
              e.proctoring_event_retention_days,
              e.proctoring_snapshot_retention_days,
              e.proctoring_heartbeat_seconds,
              e.proctoring_interruption_grace_seconds,
              (SELECT t.id FROM tasks t WHERE t.exam_id = e.id ORDER BY t.id DESC LIMIT 1) AS task_id
         FROM exam_results er
         JOIN exams e ON e.id = er.exam_id
         JOIN users u ON u.id = er.user_id
        WHERE er.attempt_id = ? AND er.exam_id = ? AND er.user_id = ?
        LIMIT 1`,
      [attemptId, examId, userId],
    )
    const row: any = rows[0]
    if (!row) return null
    return {
      attemptId: String(row.attempt_id),
      examId: Number(row.exam_id),
      taskId: row.task_id == null ? null : Number(row.task_id),
      userId: Number(row.user_id),
      resultStatus: String(row.result_status || 'in_progress'),
      dataRegion: toRegion(row.data_region),
      ageBand: String(row.age_band || 'UNKNOWN').toUpperCase(),
      policy: normalizeProctoringPolicy({
        level: row.proctoring_level,
        policyVersion: row.proctoring_policy_version,
        noticeVersion: row.proctoring_notice_version,
        requireIdentityVerification: Boolean(row.proctoring_require_identity),
        eventRetentionDays: row.proctoring_event_retention_days,
        snapshotRetentionDays: row.proctoring_snapshot_retention_days,
        heartbeatIntervalSeconds: row.proctoring_heartbeat_seconds,
        interruptionGraceSeconds: row.proctoring_interruption_grace_seconds,
      }),
      allowMinors: Boolean(row.proctoring_allow_minors),
      examEndsAt: asIso(row.exam_ends_at),
    }
  },

  async hasGuardianConsent(userId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM guardian_consents
        WHERE child_user_id = ?
          AND purpose = 'STRICT_PROCTORING'
          AND status = 'GRANTED'
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1`,
      [userId],
    )
    return rows.length > 0
  },

  async findConsentByAttempt(attemptId: string, userId: number): Promise<ProctoringConsent | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proctoring_consents WHERE attempt_id = ? AND user_id = ? LIMIT 1',
      [attemptId, userId],
    )
    return rows[0] ? toConsent(rows[0]) : null
  },

  async findConsentById(consentId: string, userId: number): Promise<ProctoringConsent | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proctoring_consents WHERE consent_id = ? AND user_id = ? LIMIT 1',
      [consentId, userId],
    )
    return rows[0] ? toConsent(rows[0]) : null
  },

  async insertConsent(input: {
    consentId: string
    context: ProctoringAttemptContext
    policyDigest: string
    categories: string[]
    locale?: string | null
    expiresAt: Date
  }): Promise<ProctoringConsent> {
    await pool.query<ResultSetHeader>(
      `INSERT INTO proctoring_consents
        (consent_id, attempt_id, exam_id, user_id, data_region, policy_version, notice_version,
         policy_digest, categories_json, locale, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.consentId,
        input.context.attemptId,
        input.context.examId,
        input.context.userId,
        input.context.dataRegion.toUpperCase(),
        input.context.policy.policyVersion,
        input.context.policy.noticeVersion,
        input.policyDigest,
        JSON.stringify(input.categories),
        input.locale || null,
        input.expiresAt,
      ],
    )
    const inserted = await this.findConsentById(input.consentId, input.context.userId)
    if (!inserted) throw new Error('Failed to read inserted proctoring consent')
    return inserted
  },

  async findSessionByAttempt(attemptId: string, userId: number): Promise<ProctoringSession | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proctoring_sessions WHERE attempt_id = ? AND user_id = ? LIMIT 1',
      [attemptId, userId],
    )
    return rows[0] ? toSession(rows[0]) : null
  },

  async findSessionById(sessionId: string, userId: number): Promise<ProctoringSession | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM proctoring_sessions WHERE session_id = ? AND user_id = ? LIMIT 1',
      [sessionId, userId],
    )
    return rows[0] ? toSession(rows[0]) : null
  },

  async insertSession(input: {
    sessionId: string
    consent: ProctoringConsent
    context: ProctoringAttemptContext
  }): Promise<ProctoringSession> {
    await pool.query<ResultSetHeader>(
      `INSERT INTO proctoring_sessions
        (session_id, consent_id, attempt_id, exam_id, task_id, user_id, data_region,
         camera_required, microphone_required, identity_required, identity_status,
         retain_until, retention_policy_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [
        input.sessionId,
        input.consent.consentId,
        input.context.attemptId,
        input.context.examId,
        input.context.taskId,
        input.context.userId,
        input.context.dataRegion.toUpperCase(),
        input.context.policy.requireCamera,
        input.context.policy.requireMicrophone,
        input.context.policy.requireIdentityVerification,
        input.context.policy.requireIdentityVerification ? 'pending' : 'not_required',
        input.context.policy.eventRetentionDays,
        'wenheng-lifecycle-2026-08-v1',
      ],
    )
    const inserted = await this.findSessionById(input.sessionId, input.context.userId)
    if (!inserted) throw new Error('Failed to read inserted proctoring session')
    return inserted
  },

  async recordEvent(input: {
    sessionId: string
    userId: number
    event: NormalizedFactualEvent
    nextState: ProctoringSessionState
    reviewReasonCode?: string | null
    reviewCaseId?: string | null
  }): Promise<{ session: ProctoringSession; event: StoredProctoringEvent; replayed: boolean }> {
    const connection = (await (pool as any).getConnection()) as PoolConnection
    try {
      await connection.beginTransaction()
      const session = await selectSession(connection, input.sessionId, input.userId, true)
      if (!session) throw Object.assign(new Error('监考会话不存在'), { status: 404, code: 'PROCTORING_SESSION_NOT_FOUND' })

      const [existingRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM proctoring_events WHERE event_id = ? LIMIT 1',
        [input.event.eventId],
      )
      const existing: any = existingRows[0]
      if (existing) {
        const sameEvent =
          String(existing.session_id) === session.sessionId &&
          Number(existing.user_id) === session.userId &&
          Number(existing.sequence) === input.event.sequence &&
          String(existing.event_type) === input.event.type &&
          JSON.stringify(parseJson(existing.state_json, {})) === JSON.stringify(input.event.state)
        if (!sameEvent) {
          throw Object.assign(new Error('监考事件编号已被其他内容使用'), {
            status: 409,
            code: 'PROCTORING_EVENT_ID_CONFLICT',
          })
        }
        const stored: StoredProctoringEvent = {
          eventId: String(existing.event_id),
          sessionId: String(existing.session_id),
          examId: Number(existing.exam_id),
          userId: Number(existing.user_id),
          sequence: Number(existing.sequence),
          type: String(existing.event_type) as StoredProctoringEvent['type'],
          severity: String(existing.severity) as ProctoringSeverity,
          state: parseJson(existing.state_json, {}),
          occurredAt: asIso(existing.occurred_at) || new Date(0).toISOString(),
          receivedAt: asIso(existing.received_at) || new Date(0).toISOString(),
        }
        await connection.commit()
        return { session, event: stored, replayed: true }
      }

      if (input.event.sequence !== session.lastSequence + 1) {
        throw Object.assign(new Error('监考事件序号不连续'), {
          status: 409,
          code: 'PROCTORING_EVENT_SEQUENCE_CONFLICT',
        })
      }

      await connection.query<ResultSetHeader>(
        `INSERT INTO proctoring_events
          (event_id, session_id, exam_id, user_id, sequence, event_type, severity, state_json,
           occurred_at, retain_until, retention_policy_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                 (SELECT retain_until FROM proctoring_sessions WHERE session_id=?),
                 'wenheng-lifecycle-2026-08-v1')`,
        [
          input.event.eventId,
          session.sessionId,
          session.examId,
          session.userId,
          input.event.sequence,
          input.event.type,
          input.event.severity,
          JSON.stringify(input.event.state),
          new Date(input.event.occurredAt),
          session.sessionId,
        ],
      )

      const interruptionStartedAt =
        input.nextState === 'interrupted' && session.state !== 'interrupted' ? new Date() : session.interruptionStartedAt
      await connection.query<ResultSetHeader>(
        `UPDATE proctoring_sessions
            SET state = ?, last_sequence = ?,
                started_at = CASE WHEN ? = 'active' AND started_at IS NULL THEN NOW() ELSE started_at END,
                last_heartbeat_at = CASE WHEN ? = 'active' THEN NOW() ELSE last_heartbeat_at END,
                interruption_started_at = ?,
                completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END,
                review_reason_code = COALESCE(?, review_reason_code)
          WHERE session_id = ? AND user_id = ?`,
        [
          input.nextState,
          input.event.sequence,
          input.nextState,
          input.nextState,
          interruptionStartedAt,
          input.nextState,
          input.reviewReasonCode || null,
          session.sessionId,
          session.userId,
        ],
      )

      const updated = await selectSession(connection, session.sessionId, session.userId)
      if (!updated) throw new Error('Failed to read updated proctoring session')
      if (updated.state === 'review_required' && input.reviewCaseId) {
        await ensureReviewCaseInTransaction(connection, updated, {
          reviewCaseId: input.reviewCaseId,
          reasonCode: input.reviewReasonCode || updated.reviewReasonCode || 'REVIEW_REQUIRED',
        })
      }
      const stored: StoredProctoringEvent = {
        eventId: input.event.eventId,
        sessionId: session.sessionId,
        examId: session.examId,
        userId: session.userId,
        sequence: input.event.sequence,
        type: input.event.type,
        severity: input.event.severity,
        state: input.event.state,
        occurredAt: input.event.occurredAt,
        receivedAt: new Date().toISOString(),
      }
      await connection.commit()
      return { session: updated, event: stored, replayed: false }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },

  async heartbeat(input: {
    sessionId: string
    userId: number
    state: ProctoringSessionState
    resume: boolean
    reviewReasonCode: string | null
    reviewCaseId?: string | null
  }): Promise<ProctoringSession | null> {
    const connection = (await (pool as any).getConnection()) as PoolConnection
    try {
      await connection.beginTransaction()
      const session = await selectSession(connection, input.sessionId, input.userId, true)
      if (!session) {
        await connection.commit()
        return null
      }
      if (session.state !== 'completed' && session.state !== 'review_required') {
        await connection.query<ResultSetHeader>(
          `UPDATE proctoring_sessions
              SET last_heartbeat_at = NOW(),
                  state = ?,
                  interruption_started_at = CASE
                    WHEN ? THEN NULL
                    WHEN ? = 'interrupted' AND interruption_started_at IS NULL THEN NOW()
                    ELSE interruption_started_at
                  END,
                  review_reason_code = COALESCE(?, review_reason_code)
            WHERE session_id = ? AND user_id = ?`,
          [
            input.state,
            input.resume,
            input.state,
            input.reviewReasonCode,
            input.sessionId,
            input.userId,
          ],
        )
      }
      const updated = await selectSession(connection, input.sessionId, input.userId)
      if (updated?.state === 'review_required' && input.reviewCaseId) {
        await ensureReviewCaseInTransaction(connection, updated, {
          reviewCaseId: input.reviewCaseId,
          reasonCode: input.reviewReasonCode || updated.reviewReasonCode || 'REVIEW_REQUIRED',
        })
      }
      await connection.commit()
      return updated
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },

  async insertIdentityCheck(input: {
    session: ProctoringSession
    check: ProctoringIdentityCheck
    reviewCaseId?: string | null
  }): Promise<ProctoringSession> {
    const connection = (await (pool as any).getConnection()) as PoolConnection
    try {
      await connection.beginTransaction()
      await connection.query<ResultSetHeader>(
        `INSERT INTO proctoring_identity_checks
          (check_id, session_id, exam_id, user_id, result, reason_code, similarity,
           liveness_passed, model, retain_until, retention_policy_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                 (SELECT retain_until FROM proctoring_sessions WHERE session_id=?),
                 'wenheng-lifecycle-2026-08-v1')`,
        [
          input.check.checkId,
          input.session.sessionId,
          input.session.examId,
          input.session.userId,
          input.check.result,
          input.check.reasonCode,
          input.check.similarity,
          input.check.livenessPassed,
          input.check.model,
          input.session.sessionId,
        ],
      )
      const nextState = input.check.result === 'passed' ? input.session.state : 'review_required'
      await connection.query<ResultSetHeader>(
        `UPDATE proctoring_sessions
            SET identity_status = ?, state = ?, review_reason_code = ?
          WHERE session_id = ? AND user_id = ?`,
        [
          input.check.result,
          nextState,
          input.check.result === 'passed' ? null : input.check.reasonCode || 'IDENTITY_VERIFICATION_FAILED',
          input.session.sessionId,
          input.session.userId,
        ],
      )
      const updated = await selectSession(connection, input.session.sessionId, input.session.userId)
      if (!updated) throw new Error('Failed to read identity check session')
      if (updated.state === 'review_required' && input.reviewCaseId) {
        await ensureReviewCaseInTransaction(connection, updated, {
          reviewCaseId: input.reviewCaseId,
          reasonCode: input.check.reasonCode || updated.reviewReasonCode || 'IDENTITY_VERIFICATION_FAILED',
        })
      }
      await connection.commit()
      return updated
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },

  async listByExam(params: ListParams) {
    const { examId, userId, severity, page = 1, limit = 20 } = params
    const conditions = ['exam_id = ?']
    const values: any[] = [examId]
    if (typeof userId === 'number') {
      conditions.push('user_id = ?')
      values.push(userId)
    }
    if (severity) {
      conditions.push('severity = ?')
      values.push(severity)
    }
    const where = conditions.join(' AND ')
    const offset = Math.max(0, (Number(page) - 1) * Number(limit))
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, exam_id, user_id, severity, event_type, state_json, occurred_at, received_at
         FROM proctoring_events
        WHERE ${where}
        ORDER BY occurred_at DESC
        LIMIT ${safeLimit} OFFSET ${offset}`,
      values,
    )
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM proctoring_events WHERE ${where}`,
      values,
    )
    const items = rows.map((row: any) => ({
      id: Number(row.id),
      exam_id: Number(row.exam_id),
      user_id: Number(row.user_id),
      severity: String(row.severity) as ProctoringSeverity,
      type: String(row.event_type),
      message: null,
      meta: parseJson(row.state_json, {}),
      occurred_at: asIso(row.occurred_at),
      created_at: asIso(row.received_at) || new Date(0).toISOString(),
    })) as ProctoringEvent[]
    return { items, total: Number(countRows[0]?.total || 0), page: Number(page), limit: safeLimit }
  },

  async summaryByExam(examId: number, userId?: number): Promise<ProctoringSummary> {
    const values: any[] = [examId]
    let where = 'exam_id = ?'
    if (typeof userId === 'number') {
      where += ' AND user_id = ?'
      values.push(userId)
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT severity, COUNT(*) AS cnt FROM proctoring_events WHERE ${where} GROUP BY severity`,
      values,
    )
    const summary: ProctoringSummary = { total: 0, info: 0, warn: 0, critical: 0 }
    for (const row of rows as any[]) {
      const severity = String(row.severity || 'info')
      const count = Number(row.cnt || 0)
      summary.total += count
      if (severity === 'critical') summary.critical += count
      else if (severity === 'warn') summary.warn += count
      else summary.info += count
    }
    return summary
  },
}

export default ProctoringRepository
