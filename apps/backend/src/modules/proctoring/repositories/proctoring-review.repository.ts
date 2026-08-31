import { pool } from '@/config/database'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type {
  AddAppealInput,
  AddCandidateResponseInput,
  ApplyDecisionInput,
  CandidateCaseQuery,
  CandidateReviewCaseDetail,
  CandidateReviewCaseListItem,
  ProctoringReviewRepositoryContract,
  ReviewActor,
  ReviewAppealRecord,
  ReviewCaseDetail,
  ReviewCaseListItem,
  ReviewDecisionRecord,
  ReviewEventSummary,
  ReviewIdentitySummary,
  ReviewMessageRecord,
  ReviewStoredWrite,
  ReviewWriteResult,
  StaffCaseQuery,
} from '../domain/proctoring-review.model.js'
import {
  ProctoringReviewPolicyError,
  type ReviewCaseProjection,
  type ReviewCaseStatus,
  type ReviewOutcome,
  type ReviewReasonCode,
  type StaffReviewAction,
} from '../domain/proctoring-review.policy.js'
import type { ProctoringSession } from '../domain/proctoring.model.js'
import type { ProctoringSessionState } from '../domain/proctoring.policy.js'

const TABLES = {
  cases: 'proctoring_review_cases',
  decisions: 'proctoring_review_decisions',
  messages: 'proctoring_review_messages',
  appeals: 'proctoring_review_appeals',
} as const

type Queryable = Pick<PoolConnection, 'query'>

const asIso = (value: unknown): string | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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

const toRegion = (value: unknown): 'cn' | 'global' =>
  String(value || '').toUpperCase() === 'GLOBAL' ? 'global' : 'cn'

const isoOrEpoch = (value: unknown) => asIso(value) || new Date(0).toISOString()

const BASE_SELECT = `
  c.*,
  e.title AS exam_title,
  e.created_by AS exam_created_by,
  u.public_id AS candidate_public_id,
  COALESCE(u.nickname, u.username) AS candidate_display_name,
  ps.state AS session_state,
  ps.identity_status AS session_identity_status,
  ps.started_at AS session_started_at,
  ps.last_heartbeat_at AS session_last_heartbeat_at,
  ps.interruption_started_at AS session_interruption_started_at,
  ps.completed_at AS session_completed_at`

const BASE_FROM = `
  FROM ${TABLES.cases} c
  JOIN exams e ON e.id = c.exam_id
  JOIN users u ON u.id = c.user_id
  JOIN proctoring_sessions ps ON ps.session_id = c.session_id`

const toCaseListItem = (row: any): ReviewCaseListItem => ({
  caseId: String(row.case_id),
  sessionId: String(row.session_id),
  examId: Number(row.exam_id),
  taskId: row.task_id == null ? null : Number(row.task_id),
  attemptId: String(row.attempt_id),
  userId: Number(row.user_id),
  candidatePublicId: String(row.candidate_public_id || `WH-${row.user_id}`),
  candidateDisplayName: row.candidate_display_name ? String(row.candidate_display_name) : null,
  examTitle: String(row.exam_title || ''),
  dataRegion: toRegion(row.data_region),
  status: String(row.status) as ReviewCaseStatus,
  outcome: String(row.outcome) as ReviewOutcome,
  triggerReasonCode: String(row.trigger_reason_code),
  version: Number(row.version),
  openedAt: isoOrEpoch(row.opened_at),
  firstDecidedAt: asIso(row.first_decided_at),
  appealDeadlineAt: asIso(row.appeal_deadline_at),
  closedAt: asIso(row.closed_at),
  retainUntil: isoOrEpoch(row.retain_until),
  updatedAt: isoOrEpoch(row.updated_at),
})

const toCandidateListItem = (item: ReviewCaseListItem): CandidateReviewCaseListItem => ({
  caseId: item.caseId,
  examId: item.examId,
  taskId: item.taskId,
  attemptId: item.attemptId,
  examTitle: item.examTitle,
  status: item.status,
  outcome: item.outcome,
  triggerReasonCode: item.triggerReasonCode,
  version: item.version,
  openedAt: item.openedAt,
  firstDecidedAt: item.firstDecidedAt,
  appealDeadlineAt: item.appealDeadlineAt,
  closedAt: item.closedAt,
  updatedAt: item.updatedAt,
})

const actorWhere = (actor: ReviewActor) => {
  const conditions = ['c.data_region = ?']
  const values: unknown[] = [actor.dataRegion.toUpperCase()]
  if (actor.role === 'teacher') {
    conditions.push('e.created_by = ?')
    values.push(actor.createdByUserId ?? actor.userId)
  }
  return { conditions, values }
}

const findBaseRow = async (
  db: Queryable,
  caseId: string,
  scope?: { actor?: ReviewActor; userId?: number; lock?: boolean },
) => {
  const conditions = ['c.case_id = ?']
  const values: unknown[] = [caseId]
  if (scope?.actor) {
    const actor = actorWhere(scope.actor)
    conditions.push(...actor.conditions)
    values.push(...actor.values)
  }
  if (scope?.userId) {
    conditions.push('c.user_id = ?')
    values.push(scope.userId)
  }
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${BASE_SELECT} ${BASE_FROM}
      WHERE ${conditions.join(' AND ')}
      LIMIT 1${scope?.lock ? ' FOR UPDATE' : ''}`,
    values,
  )
  return rows[0] as any | undefined
}

const loadDetail = async (db: Queryable, row: any): Promise<ReviewCaseDetail> => {
  const item = toCaseListItem(row)
  const [identityRows] = await db.query<RowDataPacket[]>(
    `SELECT check_id, result, reason_code, similarity, liveness_passed, model, created_at
       FROM proctoring_identity_checks
      WHERE session_id = ?
      ORDER BY created_at ASC, id ASC`,
    [item.sessionId],
  )
  const [eventRows] = await db.query<RowDataPacket[]>(
    `SELECT event_id, sequence, event_type, severity, state_json, occurred_at, received_at
       FROM proctoring_events
      WHERE session_id = ?
      ORDER BY occurred_at ASC, sequence ASC`,
    [item.sessionId],
  )
  const [decisionRows] = await db.query<RowDataPacket[]>(
    `SELECT decision_id, actor_user_id, action, reason_code, comment,
            case_version_before, case_version_after, created_at
       FROM ${TABLES.decisions}
      WHERE case_id = ?
      ORDER BY created_at ASC, decision_id ASC`,
    [item.caseId],
  )
  const [messageRows] = await db.query<RowDataPacket[]>(
    `SELECT message_id, actor_user_id, message_type, reply_to_message_id, body,
            case_version_before, case_version_after, created_at
       FROM ${TABLES.messages}
      WHERE case_id = ?
      ORDER BY created_at ASC, message_id ASC`,
    [item.caseId],
  )
  const [appealRows] = await db.query<RowDataPacket[]>(
    `SELECT appeal_id, user_id, reason_code, statement, status, resolution_decision_id,
            submitted_at, resolved_at
       FROM ${TABLES.appeals}
      WHERE case_id = ?
      LIMIT 1`,
    [item.caseId],
  )

  const identityChecks = identityRows.map((check: any): ReviewIdentitySummary => ({
    checkId: String(check.check_id),
    result: String(check.result) as ReviewIdentitySummary['result'],
    reasonCode: check.reason_code ? String(check.reason_code) : null,
    similarity: check.similarity == null ? null : Number(check.similarity),
    livenessPassed: check.liveness_passed == null ? null : Boolean(check.liveness_passed),
    model: check.model ? String(check.model) : null,
    checkedAt: isoOrEpoch(check.created_at),
  }))
  const events = eventRows.map((event: any): ReviewEventSummary => ({
    eventId: String(event.event_id),
    sequence: Number(event.sequence),
    type: String(event.event_type),
    severity: String(event.severity) as ReviewEventSummary['severity'],
    state: parseJson<Record<string, unknown>>(event.state_json, {}),
    occurredAt: isoOrEpoch(event.occurred_at),
    receivedAt: isoOrEpoch(event.received_at),
  }))
  const decisions = decisionRows.map((decision: any): ReviewDecisionRecord => ({
    decisionId: String(decision.decision_id),
    actorUserId: Number(decision.actor_user_id),
    action: String(decision.action) as StaffReviewAction,
    reasonCode: String(decision.reason_code) as ReviewReasonCode,
    comment: String(decision.comment),
    caseVersionBefore: Number(decision.case_version_before),
    caseVersionAfter: Number(decision.case_version_after),
    createdAt: isoOrEpoch(decision.created_at),
  }))
  const messages = messageRows.map((message: any): ReviewMessageRecord => ({
    messageId: String(message.message_id),
    actorUserId: Number(message.actor_user_id),
    messageType: String(message.message_type) as ReviewMessageRecord['messageType'],
    replyToMessageId: message.reply_to_message_id ? String(message.reply_to_message_id) : null,
    body: String(message.body),
    caseVersionBefore: Number(message.case_version_before),
    caseVersionAfter: Number(message.case_version_after),
    createdAt: isoOrEpoch(message.created_at),
  }))
  const appealRow: any = appealRows[0]
  const appeal: ReviewAppealRecord | null = appealRow
    ? {
        appealId: String(appealRow.appeal_id),
        userId: Number(appealRow.user_id),
        reasonCode: String(appealRow.reason_code) as ReviewAppealRecord['reasonCode'],
        statement: String(appealRow.statement),
        status: String(appealRow.status) as ReviewAppealRecord['status'],
        resolutionDecisionId: appealRow.resolution_decision_id ? String(appealRow.resolution_decision_id) : null,
        submittedAt: isoOrEpoch(appealRow.submitted_at),
        resolvedAt: asIso(appealRow.resolved_at),
      }
    : null

  return {
    ...item,
    session: {
      state: String(row.session_state) as ProctoringSessionState,
      identityStatus: String(row.session_identity_status) as ReviewCaseDetail['session']['identityStatus'],
      startedAt: asIso(row.session_started_at),
      lastHeartbeatAt: asIso(row.session_last_heartbeat_at),
      interruptionStartedAt: asIso(row.session_interruption_started_at),
      completedAt: asIso(row.session_completed_at),
    },
    identityChecks,
    events,
    decisions,
    messages,
    appeal,
  }
}

const lockVersion = (row: any, expectedVersion: number) => {
  if (Number(row.version) !== expectedVersion) {
    throw new ProctoringReviewPolicyError('案件已被其他人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
  }
}

const updateProjection = async (
  connection: PoolConnection,
  caseId: string,
  expectedVersion: number,
  next: ReviewCaseProjection,
) => {
  const [result] = await connection.query<ResultSetHeader>(
    `UPDATE ${TABLES.cases}
        SET status = ?, outcome = ?, version = ?, first_decided_at = ?, appeal_deadline_at = ?,
            closed_at = ?, retain_until = GREATEST(retain_until, COALESCE(?, retain_until)), updated_at = ?
      WHERE case_id = ? AND version = ?`,
    [
      next.status,
      next.outcome,
      next.version,
      next.firstDecidedAt,
      next.appealDeadlineAt,
      next.closedAt,
      next.appealDeadlineAt,
      next.updatedAt,
      caseId,
      expectedVersion,
    ],
  )
  if (result.affectedRows !== 1) {
    throw new ProctoringReviewPolicyError('案件已被其他人员更新', 'PROCTORING_REVIEW_VERSION_CONFLICT', 409)
  }
}

const duplicateError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ER_DUP_ENTRY'

const runTransaction = async <T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> => {
  const connection = (await (pool as any).getConnection()) as PoolConnection
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    if (duplicateError(error)) {
      throw new ProctoringReviewPolicyError(
        '操作编号已经被使用，请刷新案件后重试',
        'PROCTORING_REVIEW_IDEMPOTENCY_CONFLICT',
        409,
      )
    }
    throw error
  } finally {
    connection.release()
  }
}

export async function ensureReviewCaseInTransaction(
  connection: PoolConnection,
  session: ProctoringSession,
  input: { reviewCaseId: string; reasonCode: string },
): Promise<void> {
  await connection.query<ResultSetHeader>(
    `INSERT IGNORE INTO ${TABLES.cases}
      (case_id, session_id, exam_id, task_id, attempt_id, user_id, data_region,
       status, outcome, trigger_reason_code, version, opened_at, retain_until)
     SELECT ?, ?, ?, ?, ?, ?, ?, 'pending_review', 'pending', ?, 1,
            CURRENT_TIMESTAMP,
            DATE_ADD(CURRENT_TIMESTAMP, INTERVAL COALESCE(e.proctoring_event_retention_days, 180) DAY)
       FROM exams e
      WHERE e.id = ?`,
    [
      input.reviewCaseId,
      session.sessionId,
      session.examId,
      session.taskId,
      session.attemptId,
      session.userId,
      session.dataRegion.toUpperCase(),
      input.reasonCode,
      session.examId,
    ],
  )
}

export const ProctoringReviewRepository: ProctoringReviewRepositoryContract = {
  async listStaffCases(input: StaffCaseQuery) {
    const scope = actorWhere(input.actor)
    const conditions = [...scope.conditions]
    const values = [...scope.values]
    if (input.status) {
      conditions.push('c.status = ?')
      values.push(input.status)
    }
    if (input.outcome) {
      conditions.push('c.outcome = ?')
      values.push(input.outcome)
    }
    if (input.examId) {
      conditions.push('c.exam_id = ?')
      values.push(input.examId)
    }
    if (input.reasonCode) {
      conditions.push('c.trigger_reason_code = ?')
      values.push(input.reasonCode)
    }
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit) || 20))
    const page = Math.max(1, Math.trunc(input.page) || 1)
    const offset = (page - 1) * limit
    const where = conditions.join(' AND ')
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${BASE_SELECT} ${BASE_FROM}
        WHERE ${where}
        ORDER BY c.updated_at DESC, c.case_id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      values,
    )
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${BASE_FROM} WHERE ${where}`,
      values,
    )
    return { items: rows.map(toCaseListItem), total: Number(countRows[0]?.total || 0), page, limit }
  },

  async listCandidateCases(input: CandidateCaseQuery) {
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit) || 20))
    const page = Math.max(1, Math.trunc(input.page) || 1)
    const offset = (page - 1) * limit
    const conditions = ['c.user_id = ?']
    const values: unknown[] = [input.userId]
    if (input.attemptId) {
      conditions.push('c.attempt_id = ?')
      values.push(input.attemptId)
    }
    const where = conditions.join(' AND ')
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${BASE_SELECT} ${BASE_FROM}
        WHERE ${where}
        ORDER BY c.updated_at DESC, c.case_id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      values,
    )
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ${TABLES.cases} c WHERE ${where}`,
      values,
    )
    return {
      items: rows.map(row => toCandidateListItem(toCaseListItem(row))),
      total: Number(countRows[0]?.total || 0),
      page,
      limit,
    }
  },

  async findCaseForStaff(caseId: string, actor: ReviewActor) {
    const row = await findBaseRow(pool as unknown as Queryable, caseId, { actor })
    return row ? loadDetail(pool as unknown as Queryable, row) : null
  },

  async findCaseForCandidate(caseId: string, userId: number) {
    const row = await findBaseRow(pool as unknown as Queryable, caseId, { userId })
    if (!row) return null
    return loadDetail(pool as unknown as Queryable, row)
  },

  async findStoredWrite(kind, requestId): Promise<ReviewStoredWrite | null> {
    const config = kind === 'decision'
      ? { table: TABLES.decisions, id: 'decision_id' }
      : kind === 'message'
        ? { table: TABLES.messages, id: 'message_id' }
        : { table: TABLES.appeals, id: 'appeal_id' }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT case_id, request_digest FROM ${config.table} WHERE ${config.id} = ? LIMIT 1`,
      [requestId],
    )
    const stored: any = rows[0]
    if (!stored) return null
    const row = await findBaseRow(pool as unknown as Queryable, String(stored.case_id))
    if (!row) return null
    const detail = await loadDetail(pool as unknown as Queryable, row)
    return {
      kind,
      requestId,
      requestDigest: String(stored.request_digest),
      result: { case: detail, replayed: false },
    }
  },

  async applyDecision(input: ApplyDecisionInput): Promise<ReviewWriteResult> {
    return runTransaction(async connection => {
      const row = await findBaseRow(connection, input.caseId, { actor: input.actor, lock: true })
      if (!row) throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
      lockVersion(row, input.expectedVersion)
      await updateProjection(connection, input.caseId, input.expectedVersion, input.nextCase)
      await connection.query<ResultSetHeader>(
        `INSERT INTO ${TABLES.decisions}
          (decision_id, case_id, actor_user_id, action, reason_code, comment, request_digest,
           case_version_before, case_version_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.decisionId,
          input.caseId,
          input.actor.userId,
          input.action,
          input.reasonCode,
          input.comment,
          input.requestDigest,
          input.expectedVersion,
          input.nextCase.version,
          input.nextCase.updatedAt,
        ],
      )
      if (input.action === 'request_information' && input.messageId && input.informationRequest) {
        await connection.query<ResultSetHeader>(
          `INSERT INTO ${TABLES.messages}
            (message_id, case_id, actor_user_id, message_type, reply_to_message_id, body, request_digest,
             case_version_before, case_version_after, created_at)
           VALUES (?, ?, ?, 'information_request', NULL, ?, ?, ?, ?, ?)`,
          [
            input.messageId,
            input.caseId,
            input.actor.userId,
            input.informationRequest,
            input.requestDigest,
            input.expectedVersion,
            input.nextCase.version,
            input.nextCase.updatedAt,
          ],
        )
      }
      if (input.action === 'resolve_appeal_upheld' || input.action === 'resolve_appeal_rejected') {
        const status = input.action === 'resolve_appeal_upheld' ? 'upheld' : 'rejected'
        const [appealResult] = await connection.query<ResultSetHeader>(
          `UPDATE ${TABLES.appeals}
              SET status = ?, resolution_decision_id = ?, resolved_at = ?
            WHERE case_id = ? AND status = 'pending'`,
          [status, input.decisionId, input.nextCase.updatedAt, input.caseId],
        )
        if (appealResult.affectedRows !== 1) {
          throw new ProctoringReviewPolicyError('待处理申诉不存在', 'PROCTORING_REVIEW_APPEAL_NOT_FOUND', 409)
        }
      }
      const updatedRow = await findBaseRow(connection, input.caseId)
      if (!updatedRow) throw new Error('Failed to read updated proctoring review case')
      return { case: await loadDetail(connection, updatedRow), replayed: false }
    })
  },

  async addCandidateResponse(input: AddCandidateResponseInput): Promise<ReviewWriteResult> {
    return runTransaction(async connection => {
      const row = await findBaseRow(connection, input.caseId, { userId: input.userId, lock: true })
      if (!row) throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
      lockVersion(row, input.expectedVersion)
      const [requestRows] = await connection.query<RowDataPacket[]>(
        `SELECT message_id
           FROM ${TABLES.messages} request
          WHERE request.message_id = ? AND request.case_id = ? AND request.message_type = 'information_request'
            AND NOT EXISTS (
              SELECT 1 FROM ${TABLES.messages} response
               WHERE response.reply_to_message_id = request.message_id
                 AND response.message_type = 'candidate_response'
            )
          LIMIT 1`,
        [input.replyToMessageId, input.caseId],
      )
      if (!requestRows[0]) {
        throw new ProctoringReviewPolicyError(
          '补充信息请求不存在或已经回复',
          'PROCTORING_REVIEW_RESPONSE_CONFLICT',
          409,
        )
      }
      await updateProjection(connection, input.caseId, input.expectedVersion, input.nextCase)
      await connection.query<ResultSetHeader>(
        `INSERT INTO ${TABLES.messages}
          (message_id, case_id, actor_user_id, message_type, reply_to_message_id, body, request_digest,
           case_version_before, case_version_after, created_at)
         VALUES (?, ?, ?, 'candidate_response', ?, ?, ?, ?, ?, ?)`,
        [
          input.messageId,
          input.caseId,
          input.userId,
          input.replyToMessageId,
          input.body,
          input.requestDigest,
          input.expectedVersion,
          input.nextCase.version,
          input.nextCase.updatedAt,
        ],
      )
      const updatedRow = await findBaseRow(connection, input.caseId)
      if (!updatedRow) throw new Error('Failed to read updated proctoring review case')
      return { case: await loadDetail(connection, updatedRow), replayed: false }
    })
  },

  async addAppeal(input: AddAppealInput): Promise<ReviewWriteResult> {
    return runTransaction(async connection => {
      const row = await findBaseRow(connection, input.caseId, { userId: input.userId, lock: true })
      if (!row) throw new ProctoringReviewPolicyError('复核案件不存在', 'PROCTORING_REVIEW_CASE_NOT_FOUND', 404)
      lockVersion(row, input.expectedVersion)
      const [existingRows] = await connection.query<RowDataPacket[]>(
        `SELECT appeal_id FROM ${TABLES.appeals} WHERE case_id = ? LIMIT 1`,
        [input.caseId],
      )
      if (existingRows[0]) {
        throw new ProctoringReviewPolicyError(
          '本案件已经提交过申诉',
          'PROCTORING_REVIEW_APPEAL_ALREADY_SUBMITTED',
          409,
        )
      }
      await updateProjection(connection, input.caseId, input.expectedVersion, input.nextCase)
      await connection.query<ResultSetHeader>(
        `INSERT INTO ${TABLES.appeals}
          (appeal_id, case_id, user_id, reason_code, statement, status, request_digest, submitted_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          input.appealId,
          input.caseId,
          input.userId,
          input.reasonCode,
          input.statement,
          input.requestDigest,
          input.nextCase.updatedAt,
        ],
      )
      const updatedRow = await findBaseRow(connection, input.caseId)
      if (!updatedRow) throw new Error('Failed to read updated proctoring review case')
      return { case: await loadDetail(connection, updatedRow), replayed: false }
    })
  },
}

export default ProctoringReviewRepository
