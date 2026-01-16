import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const table = 'wrong_questions'
  if (!(await knex.schema.hasTable(table))) return

  if (!(await knex.schema.hasColumn(table, 'created_at'))) {
    await knex.schema.alterTable(table, t => {
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasColumn(table, 'updated_at'))) {
    await knex.schema.alterTable(table, t => {
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const table = 'wrong_questions'
  if (!(await knex.schema.hasTable(table))) return
  if (await knex.schema.hasColumn(table, 'updated_at')) {
    await knex.schema.alterTable(table, t => t.dropColumn('updated_at'))
  }
  if (await knex.schema.hasColumn(table, 'created_at')) {
    await knex.schema.alterTable(table, t => t.dropColumn('created_at'))
  }
}
