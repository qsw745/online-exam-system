import type { Knex } from 'knex'

const TABLE = 'exams'
const COLUMN = 'created_by'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return
  const hasColumn = await knex.schema.hasColumn(TABLE, COLUMN)
  if (!hasColumn) {
    await knex.schema.alterTable(TABLE, table => {
      table.integer(COLUMN).unsigned().nullable().comment('创建人').index()
    })
  }
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
