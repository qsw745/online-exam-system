import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('ai_chat_sessions')
  if (exists) return

  await knex.schema.createTable('ai_chat_sessions', t => {
    t.bigIncrements('id').primary()
    t.bigInteger('user_id').notNullable().index()
    t.string('client_id', 64).notNullable()
    t.string('title', 255).nullable()
    t.text('items_json', 'longtext').notNullable()
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    t.unique(['user_id', 'client_id'], { indexName: 'uk_ai_chat_sessions_user_client' })
  })
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('ai_chat_sessions')) {
    await knex.schema.dropTable('ai_chat_sessions')
  }
}
