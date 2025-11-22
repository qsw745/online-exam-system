import type { Knex } from 'knex'

const TABLE = 'mail_messages'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return
  await knex.schema.alterTable(TABLE, t => {
    t
      .enum('status', ['draft', 'sent', 'recalled'])
      .notNullable()
      .defaultTo('draft')
      .alter()
  })
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return
  await knex.schema.alterTable(TABLE, t => {
    t
      .enum('status', ['draft', 'sent'])
      .notNullable()
      .defaultTo('draft')
      .alter()
  })
}
