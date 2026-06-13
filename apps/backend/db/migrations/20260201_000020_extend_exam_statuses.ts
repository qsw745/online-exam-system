import type { Knex } from 'knex'

const TABLE = 'exams'
const COL = 'status'

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn(TABLE, COL)
  if (!hasCol) return
  await knex.raw(
    `ALTER TABLE ${TABLE} MODIFY COLUMN ${COL} ENUM('draft','reviewing','approved','published','closed','rejected') NOT NULL DEFAULT 'draft'`
  )
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn(TABLE, COL)
  if (!hasCol) return
  await knex.raw(`ALTER TABLE ${TABLE} MODIFY COLUMN ${COL} ENUM('draft','published','closed') NOT NULL DEFAULT 'draft'`)
}
