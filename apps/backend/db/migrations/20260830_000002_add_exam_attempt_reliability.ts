import type { Knex } from 'knex'

const TABLE = 'exam_results'
const UNIQUE_ATTEMPT = 'uk_exam_results_attempt_id'
const UNIQUE_EXAM_USER = 'uk_exam_results_exam_user'
const UNIQUE_SUBMISSION = 'uk_exam_results_submission_id'

async function hasIndex(knex: Knex, name: string) {
  const [rows] = await knex.raw(
    `SELECT 1
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
      LIMIT 1`,
    [TABLE, name],
  )
  return Array.isArray(rows) && rows.length > 0
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) throw new Error('exam_results table is required')

  const [duplicates] = await knex.raw(
    `SELECT exam_id, user_id, COUNT(*) AS count
       FROM exam_results
      WHERE exam_id IS NOT NULL AND user_id IS NOT NULL
      GROUP BY exam_id, user_id
     HAVING COUNT(*) > 1
      LIMIT 1`,
  )
  if (Array.isArray(duplicates) && duplicates.length > 0) {
    throw new Error(
      'exam_results contains duplicate exam_id/user_id rows; reconcile duplicate attempts before applying reliability migration',
    )
  }

  if (!(await knex.schema.hasColumn(TABLE, 'attempt_id'))) {
    await knex.schema.alterTable(TABLE, table => table.uuid('attempt_id').nullable())
    await knex.raw('UPDATE exam_results SET attempt_id = UUID() WHERE attempt_id IS NULL')
    await knex.schema.alterTable(TABLE, table => table.uuid('attempt_id').notNullable().alter())
  }
  if (!(await knex.schema.hasColumn(TABLE, 'submission_id'))) {
    await knex.schema.alterTable(TABLE, table => table.uuid('submission_id').nullable())
  }
  if (!(await knex.schema.hasColumn(TABLE, 'submission_payload_hash'))) {
    await knex.schema.alterTable(TABLE, table => table.string('submission_payload_hash', 64).nullable())
  }
  if (!(await knex.schema.hasColumn(TABLE, 'submission_response_json'))) {
    await knex.schema.alterTable(TABLE, table => table.json('submission_response_json').nullable())
  }

  if (!(await hasIndex(knex, UNIQUE_ATTEMPT))) {
    await knex.schema.alterTable(TABLE, table => table.unique(['attempt_id'], UNIQUE_ATTEMPT))
  }
  if (!(await hasIndex(knex, UNIQUE_EXAM_USER))) {
    await knex.schema.alterTable(TABLE, table => table.unique(['exam_id', 'user_id'], UNIQUE_EXAM_USER))
  }
  if (!(await hasIndex(knex, UNIQUE_SUBMISSION))) {
    await knex.schema.alterTable(TABLE, table => table.unique(['submission_id'], UNIQUE_SUBMISSION))
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return
  const indexes: Array<{ name: string; columns: string[] }> = [
    { name: UNIQUE_SUBMISSION, columns: ['submission_id'] },
    { name: UNIQUE_EXAM_USER, columns: ['exam_id', 'user_id'] },
    { name: UNIQUE_ATTEMPT, columns: ['attempt_id'] },
  ]
  for (const index of indexes) {
    if (await hasIndex(knex, index.name)) {
      await knex.schema.alterTable(TABLE, table => table.dropUnique(index.columns, index.name))
    }
  }
  for (const column of [
    'submission_response_json',
    'submission_payload_hash',
    'submission_id',
    'attempt_id',
  ]) {
    if (await knex.schema.hasColumn(TABLE, column)) {
      await knex.schema.alterTable(TABLE, table => table.dropColumn(column))
    }
  }
}
