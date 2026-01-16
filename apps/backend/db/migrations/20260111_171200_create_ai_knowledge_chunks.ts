import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('ai_knowledge_chunks')
  if (exists) return

  await knex.schema.createTable('ai_knowledge_chunks', t => {
    t.bigIncrements('id').primary()
    t.string('title', 255).nullable()
    t.text('content', 'longtext').notNullable()
    t.string('tags', 255).nullable()
    t.string('source', 255).nullable()
    t.text('embedding_json', 'longtext').nullable()
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('ai_knowledge_chunks')) {
    await knex.schema.dropTable('ai_knowledge_chunks')
  }
}
