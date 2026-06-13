import type { Knex } from 'knex'

const TABLE = 'questions'
const COL = 'exam_id'

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn(TABLE, COL)
  if (!hasCol) {
    await knex.schema.alterTable(TABLE, t => {
      t.bigInteger(COL).unsigned().nullable().index().comment('关联 exams.id，可为空')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn(TABLE, COL)
  if (hasCol) {
    await knex.schema.alterTable(TABLE, t => {
      t.dropColumn(COL)
    })
  }
}
