import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('ai_chat_logs')
  if (exists) return

  await knex.schema.createTable('ai_chat_logs', t => {
    t.bigIncrements('id').primary()
    t.bigInteger('user_id').notNullable().index()
    t.string('session_id', 64).nullable().index()
    t.string('model', 80).nullable().index()
    t.text('messages_json', 'longtext').notNullable()
    t.text('content_text', 'longtext').notNullable()
    t.text('action_json', 'longtext').nullable()
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    t.index(['user_id', 'created_at'], 'idx_ai_chat_logs_user_created_at')
    t.index(['created_at'], 'idx_ai_chat_logs_created_at')
  })
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('ai_chat_logs')) {
    await knex.schema.dropTable('ai_chat_logs')
  }
}
