import type { Knex } from 'knex'

const TABLE = 'user_discussion_stats'

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE)
  if (exists) return

  await knex.schema.createTable(TABLE, table => {
    table.bigInteger('user_id').unsigned().primary()
    table.integer('discussions_count').notNullable().defaultTo(0).comment('创建讨论数')
    table.integer('replies_count').notNullable().defaultTo(0).comment('回复数')
    table.integer('solutions_count').notNullable().defaultTo(0).comment('被采纳数')
    table.integer('reputation_score').notNullable().defaultTo(0).comment('声望')
    table.timestamp('last_active_at').nullable().comment('最后活跃时间')
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE)
  if (!exists) return
  await knex.schema.dropTable(TABLE)
}
