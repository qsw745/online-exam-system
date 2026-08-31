import { randomUUID } from 'node:crypto'

import type { LifecycleHandler } from '../services/lifecycle-worker.service'
import {
  defaultLifecycleHandlerDatabase,
  requireAccountParent,
  type LifecycleHandlerDatabase,
} from './handler-support'

const SELECT_RESULTS_SQL = `SELECT id, retain_until
  FROM exam_results
 WHERE user_id=? AND id>? ORDER BY id LIMIT ?`
const INSERT_ANONYMOUS_SUBJECT_SQL = `INSERT INTO anonymous_exam_subjects
  (anonymous_subject_id, data_region, display_label, retain_until)
 VALUES (?, ?, '已注销考生', ?)`

const fallbackRetainUntil = (context: Parameters<LifecycleHandler['executeBatch']>[0]): Date => {
  const days = context.policySnapshot?.categories.EXAM_ARCHIVE.retentionDays ?? 365
  return new Date(context.now.getTime() + days * 24 * 60 * 60 * 1000)
}

export function createAnonymizeExamArchiveHandler(input: {
  database?: LifecycleHandlerDatabase
  uuid?: () => string
} = {}): LifecycleHandler {
  const database = input.database ?? defaultLifecycleHandlerDatabase
  const uuid = input.uuid ?? randomUUID
  return {
    stepCode: 'anonymize_exam_archive',
    category: 'EXAM_ARCHIVE',
    async planCount(context) {
      const parent = requireAccountParent(context)
      return database.withTransaction(async connection => {
        const [rows] = await connection.query('SELECT COUNT(*) AS total FROM exam_results WHERE user_id=?', [parent.userId])
        return Number((rows as any[])?.[0]?.total || 0)
      })
    },
    async executeBatch(context) {
      const parent = requireAccountParent(context)
      const afterId = Number(context.cursor?.afterId || 0)
      return database.withTransaction(async connection => {
        const [rows] = await connection.query(SELECT_RESULTS_SQL, [parent.userId, afterId, context.batchSize])
        const results = rows as Array<{ id: number; retain_until?: unknown }>
        for (const result of results) {
          const anonymousSubjectId = uuid()
          const existingRetainUntil = result.retain_until ? new Date(String(result.retain_until)) : null
          const retainUntil = existingRetainUntil && !Number.isNaN(existingRetainUntil.getTime())
            ? existingRetainUntil
            : fallbackRetainUntil(context)
          await connection.query(INSERT_ANONYMOUS_SUBJECT_SQL, [anonymousSubjectId, context.dataRegion, retainUntil])
          await connection.query(
            `UPDATE answer_records
                SET user_id=NULL, anonymous_subject_id=?, retain_until=COALESCE(retain_until, ?),
                    retention_policy_version=COALESCE(retention_policy_version, ?)
              WHERE exam_result_id=?`,
            [anonymousSubjectId, retainUntil, context.policySnapshot?.version ?? 'wenheng-lifecycle-2026-08-v1', result.id],
          )
          await connection.query(
            `UPDATE proctoring_events pe
              JOIN proctoring_sessions ps ON ps.session_id=pe.session_id
                SET pe.user_id=NULL, pe.anonymous_subject_id=?, pe.retain_until=COALESCE(pe.retain_until, ?),
                    pe.retention_policy_version=COALESCE(pe.retention_policy_version, ?)
              WHERE ps.attempt_id=(SELECT attempt_id FROM exam_results WHERE id=?)`,
            [anonymousSubjectId, retainUntil, context.policySnapshot?.version ?? 'wenheng-lifecycle-2026-08-v1', result.id],
          )
          await connection.query(
            `UPDATE proctoring_identity_checks pic
              JOIN proctoring_sessions ps ON ps.session_id=pic.session_id
                SET pic.user_id=NULL, pic.anonymous_subject_id=?, pic.retain_until=COALESCE(pic.retain_until, ?),
                    pic.retention_policy_version=COALESCE(pic.retention_policy_version, ?)
              WHERE ps.attempt_id=(SELECT attempt_id FROM exam_results WHERE id=?)`,
            [anonymousSubjectId, retainUntil, context.policySnapshot?.version ?? 'wenheng-lifecycle-2026-08-v1', result.id],
          )
          await connection.query(
            `UPDATE proctoring_review_appeals
                SET user_id=NULL
              WHERE case_id IN (
                SELECT case_id FROM proctoring_review_cases
                 WHERE attempt_id=(SELECT attempt_id FROM exam_results WHERE id=?)
              )`,
            [result.id],
          )
          await connection.query(
            `UPDATE proctoring_review_cases
                SET user_id=NULL, anonymous_subject_id=?, retain_until=COALESCE(retain_until, ?),
                    retention_policy_version=COALESCE(retention_policy_version, ?)
              WHERE attempt_id=(SELECT attempt_id FROM exam_results WHERE id=?)`,
            [anonymousSubjectId, retainUntil, context.policySnapshot?.version ?? 'wenheng-lifecycle-2026-08-v1', result.id],
          )
          await connection.query(
            `UPDATE proctoring_sessions
                SET user_id=NULL, anonymous_subject_id=?, retain_until=COALESCE(retain_until, ?),
                    retention_policy_version=COALESCE(retention_policy_version, ?)
              WHERE attempt_id=(SELECT attempt_id FROM exam_results WHERE id=?)`,
            [anonymousSubjectId, retainUntil, context.policySnapshot?.version ?? 'wenheng-lifecycle-2026-08-v1', result.id],
          )
          await connection.query(
            `UPDATE proctoring_consents
                SET user_id=NULL
              WHERE attempt_id=(SELECT attempt_id FROM exam_results WHERE id=?)`,
            [result.id],
          )
          await connection.query(
            `UPDATE exam_results
                SET user_id=NULL, anonymous_subject_id=?, retain_until=COALESCE(retain_until, ?),
                    retention_policy_version=COALESCE(retention_policy_version, ?)
              WHERE id=? AND user_id=?`,
            [
              anonymousSubjectId,
              retainUntil,
              context.policySnapshot?.version ?? 'wenheng-lifecycle-2026-08-v1',
              result.id,
              parent.userId,
            ],
          )
        }
        const done = results.length < context.batchSize
        return {
          processedCount: results.length,
          nextCursor: done || results.length === 0 ? null : { afterId: results[results.length - 1].id },
          done,
        }
      })
    },
  }
}
