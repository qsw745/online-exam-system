import type { Knex } from 'knex'

const TABLE = 'favorite_shares'

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE)
  if (exists) return

  await knex.schema.createTable(TABLE, table => {
    table.bigIncrements('id').primary()
    table.bigInteger('favorite_id').unsigned().notNullable().index('idx_favshare_favorite')
    table.integer('shared_by').unsigned().notNullable().index('idx_favshare_user')
    table.string('share_code', 64).notNullable().unique()
    table.timestamp('expires_at').nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('accessed_at').nullable()
    table.foreign('favorite_id').references('favorites.id').onDelete('CASCADE')
    table.foreign('shared_by').references('users.id').onDelete('CASCADE')
  })
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE)
  if (!exists) return
  await knex.schema.dropTable(TABLE)
}
