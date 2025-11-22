import type { Knex } from 'knex'
import { computeQuestionContentSignature } from '../../src/modules/questions/utils/content-hash'

const TABLE = 'questions'
const COLUMN = 'content_hash'
const INDEX_NAME = 'idx_questions_qtype_content_hash'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  const hasColumn = await knex.schema.hasColumn(TABLE, COLUMN)
  if (!hasColumn) {
    await knex.schema.alterTable(TABLE, table => {
      table.string(COLUMN, 64).nullable()
    })
  }

  const rows = await knex(TABLE).select('id', 'content', 'question_type').whereNull(COLUMN)
  for (const row of rows) {
    const { hash } = computeQuestionContentSignature(row.question_type || '', row.content || '')
    await knex(TABLE).where('id', row.id).update({ [COLUMN]: hash })
  }

  await knex.schema.alterTable(TABLE, table => {
    table.index(['question_type', COLUMN], INDEX_NAME)
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return
  const hasColumn = await knex.schema.hasColumn(TABLE, COLUMN)
  if (hasColumn) {
    await knex.schema.alterTable(TABLE, table => {
      table.dropColumn(COLUMN)
    })
  }
}
