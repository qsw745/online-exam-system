import { pool } from '../../src/config/database'
import type { DataRegion } from '../../src/modules/privacy-lifecycle/domain/lifecycle.model'

type Options = { dataRegion: DataRegion; execute: boolean }

const parseOptions = (argv: readonly string[]): Options => {
  const region = argv.find(value => value.startsWith('--data-region='))?.slice('--data-region='.length)
  const dryRun = argv.includes('--dry-run')
  const execute = argv.includes('--execute')
  if ((region !== 'CN' && region !== 'GLOBAL') || dryRun === execute) {
    throw Object.assign(
      new Error('用法：--data-region=<CN|GLOBAL> (--dry-run|--execute)'),
      { code: 'LIFECYCLE_RETENTION_BACKFILL_OPTIONS_INVALID' },
    )
  }
  return { dataRegion: region, execute }
}

const POLICY_VERSION = 'wenheng-lifecycle-2026-08-v1'

const countMissing = async (table: string, regionSql: string, dataRegion: DataRegion): Promise<number> => {
  const [rows] = await (pool as any).query(
    `SELECT COUNT(*) AS total FROM ${table} source WHERE source.retain_until IS NULL AND ${regionSql}`,
    [dataRegion],
  )
  return Number(rows?.[0]?.total || 0)
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  try {
    const counts = {
      examArchive: await countMissing(
        'exam_results',
        'EXISTS (SELECT 1 FROM users u WHERE u.id=source.user_id AND u.data_region=?)',
        options.dataRegion,
      ),
      answerRecords: await countMissing(
        'answer_records',
        'EXISTS (SELECT 1 FROM users u WHERE u.id=source.user_id AND u.data_region=?)',
        options.dataRegion,
      ),
      proctoring: await countMissing('proctoring_sessions', 'source.data_region=?', options.dataRegion),
      securityLogs: await countMissing(
        'logs',
        'EXISTS (SELECT 1 FROM users u WHERE u.id=source.user_id AND u.data_region=?)',
        options.dataRegion,
      ),
    }
    if (options.execute) {
      const connection = await (pool as any).getConnection()
      try {
        await connection.beginTransaction()
        await connection.query(
          `UPDATE exam_results er
            JOIN users u ON u.id=er.user_id
            LEFT JOIN exams e ON e.id=er.exam_id
             SET er.retain_until=DATE_ADD(COALESCE(e.end_time, er.created_at), INTERVAL IF(e.org_id IS NULL,365,1095) DAY),
                 er.retention_policy_version=?
           WHERE u.data_region=? AND er.retain_until IS NULL AND er.retention_policy_version IS NULL`,
          [POLICY_VERSION, options.dataRegion],
        )
        await connection.query(
          `UPDATE answer_records ar
            JOIN exam_results er ON er.id=ar.exam_result_id
            JOIN users u ON u.id=ar.user_id
             SET ar.retain_until=er.retain_until, ar.retention_policy_version=er.retention_policy_version
           WHERE u.data_region=? AND ar.retain_until IS NULL AND ar.retention_policy_version IS NULL`,
          [options.dataRegion],
        )
        await connection.query(
          `UPDATE proctoring_sessions
             SET retain_until=DATE_ADD(COALESCE(completed_at, created_at), INTERVAL 180 DAY),
                 retention_policy_version=?
           WHERE data_region=? AND retain_until IS NULL AND retention_policy_version IS NULL`,
          [POLICY_VERSION, options.dataRegion],
        )
        for (const table of ['proctoring_events', 'proctoring_identity_checks', 'proctoring_review_cases']) {
          await connection.query(
            `UPDATE ${table} child JOIN proctoring_sessions ps ON ps.session_id=child.session_id
                SET child.retain_until=ps.retain_until, child.retention_policy_version=ps.retention_policy_version
              WHERE ps.data_region=? AND child.retain_until IS NULL AND child.retention_policy_version IS NULL`,
            [options.dataRegion],
          )
        }
        await connection.query(
          `UPDATE logs l JOIN users u ON u.id=l.user_id
              SET l.retain_until=DATE_ADD(l.created_at, INTERVAL 180 DAY), l.retention_policy_version=?
            WHERE u.data_region=? AND l.retain_until IS NULL AND l.retention_policy_version IS NULL`,
          [POLICY_VERSION, options.dataRegion],
        )
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    }
    console.log(JSON.stringify({ mode: options.execute ? 'EXECUTE' : 'DRY_RUN', dataRegion: options.dataRegion, counts }))
  } finally {
    await pool.end()
  }
}

void main().catch(error => {
  console.error(JSON.stringify({ status: 'FAILED', code: String(error?.code || 'LIFECYCLE_RETENTION_BACKFILL_FAILED') }))
  process.exitCode = 1
})
