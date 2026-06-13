import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('announcements')
  if (!hasTable) {
    await knex.schema.createTable('announcements', t => {
      t.increments('id').unsigned().primary()
      t.string('title', 255).notNullable()
      t.text('content').notNullable()
      t.enum('status', ['draft', 'published']).notNullable().defaultTo('draft')
      t.timestamp('published_at').nullable()
      t.integer('created_by').unsigned().nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['status', 'published_at'], 'idx_announcements_status_published')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('announcements')
  if (hasTable) {
    await knex.schema.dropTable('announcements')
  }
}
