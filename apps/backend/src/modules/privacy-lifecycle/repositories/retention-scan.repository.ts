import { randomUUID } from 'node:crypto'

import { pool } from '@/config/database'
import type { LifecycleCategoryCode, RetentionAction } from '../domain/lifecycle.model'
import type {
  RetentionScanCategory,
  RetentionScanCreateInput,
  RetentionScanRepositoryContract,
  RetentionScanRun,
} from '../services/retention-scan.service'

type StepDefinition = {
  stepCode: string
  category: LifecycleCategoryCode
  action: RetentionAction
}

const STEP_BY_CATEGORY: Record<RetentionScanCategory, StepDefinition> = {
  FACE_CREDENTIALS: { stepCode: 'retention_face_credentials', category: 'FACE_CREDENTIALS', action: 'DELETE' },
  EXAM_ARCHIVE: { stepCode: 'retention_exam_archive', category: 'EXAM_ARCHIVE', action: 'DELETE' },
  PROCTORING_AND_IDENTITY: {
    stepCode: 'retention_proctoring_identity',
    category: 'PROCTORING_AND_IDENTITY',
    action: 'DELETE',
  },
  SECURITY_LOGS: { stepCode: 'retention_security_logs', category: 'SECURITY_LOGS', action: 'ANONYMIZE' },
  RECEIPT_AND_TOMBSTONE: {
    stepCode: 'retention_receipts_tombstones',
    category: 'RECEIPT_AND_TOMBSTONE',
    action: 'NO_SUBJECT_DATA',
  },
  OUTBOX_PURGE: {
    stepCode: 'retention_outbox_purge',
    category: 'RECEIPT_AND_TOMBSTONE',
    action: 'NO_SUBJECT_DATA',
  },
  DELETION_REMINDERS: {
    stepCode: 'retention_deletion_reminders',
    category: 'RECEIPT_AND_TOMBSTONE',
    action: 'NO_SUBJECT_DATA',
  },
}

const database = pool as any

const mapRun = (row: any, resumed: boolean): RetentionScanRun => ({
  scanRunId: String(row.scan_run_id),
  dataRegion: row.data_region,
  category: row.category_code,
  windowStart: new Date(row.window_start).toISOString(),
  windowEnd: new Date(row.window_end).toISOString(),
  status: String(row.status || 'PENDING') as RetentionScanRun['status'],
  resumed,
})

const findRun = async (input: RetentionScanCreateInput): Promise<RetentionScanRun | null> => {
  const [rows] = await database.query(
    `SELECT scan_run_id, data_region, category_code, window_start, window_end, status
       FROM data_retention_scan_runs
      WHERE data_region=? AND category_code=? AND window_start=? AND window_end=?
      LIMIT 1`,
    [input.dataRegion, input.category, input.windowStart, input.windowEnd],
  )
  return rows?.[0] ? mapRun(rows[0], true) : null
}

export class RetentionScanRepository implements RetentionScanRepositoryContract {
  async createOrResume(input: RetentionScanCreateInput): Promise<RetentionScanRun> {
    const connection = await database.getConnection()
    const scanRunId = randomUUID()
    try {
      await connection.beginTransaction()
      const [existingRows] = await connection.query(
        `SELECT scan_run_id, data_region, category_code, window_start, window_end, status
           FROM data_retention_scan_runs
          WHERE data_region=? AND category_code=? AND window_start=? AND window_end=?
          LIMIT 1 FOR UPDATE`,
        [input.dataRegion, input.category, input.windowStart, input.windowEnd],
      )
      if (existingRows?.[0]) {
        await connection.commit()
        return mapRun(existingRows[0], true)
      }

      const definition = STEP_BY_CATEGORY[input.category]
      await connection.query(
        `INSERT INTO data_retention_scan_runs
          (scan_run_id, data_region, policy_version, category_code, window_start, window_end, status)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          scanRunId,
          input.dataRegion,
          input.policyVersion ?? 'wenheng-lifecycle-2026-08-v1',
          input.category,
          input.windowStart,
          input.windowEnd,
        ],
      )
      await connection.query(
        `INSERT INTO data_lifecycle_steps
          (step_id, scan_run_id, step_code, category_code, action, status)
         VALUES (?, ?, ?, ?, ?, 'PENDING')`,
        [randomUUID(), scanRunId, definition.stepCode, definition.category, definition.action],
      )
      await connection.commit()
      return {
        scanRunId,
        dataRegion: input.dataRegion,
        category: input.category,
        windowStart: input.windowStart.toISOString(),
        windowEnd: input.windowEnd.toISOString(),
        status: 'PENDING',
        resumed: false,
      }
    } catch (error: any) {
      await connection.rollback()
      if (error?.code === 'ER_DUP_ENTRY') {
        const existing = await findRun(input)
        if (existing) return existing
      }
      throw error
    } finally {
      connection.release()
    }
  }
}
