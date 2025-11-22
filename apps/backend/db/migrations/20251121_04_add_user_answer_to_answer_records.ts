import type { Knex } from 'knex'

const TABLE = 'answer_records'
const COLUMN = 'user_answer'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return
  const hasColumn = await knex.schema.hasColumn(TABLE, COLUMN)
  if (!hasColumn) {
    await knex.schema.alterTable(TABLE, table => {
      table.string(COLUMN, 255).nullable().comment('客观题作答（字母/序号），用于判分')
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
