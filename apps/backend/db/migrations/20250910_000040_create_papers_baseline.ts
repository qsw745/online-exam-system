import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('papers'))) {
    await knex.schema.createTable('papers', t => {
      t.increments('id').unsigned().primary()
      t.string('title', 200).notNullable()
      t.text('description').nullable()
      t.integer('total_score').unsigned().nullable()
      t.integer('duration_minutes').unsigned().nullable()
      // 注意：这里先不建 difficulty，留给 20250918_* 去 add/alter
      t.boolean('is_published').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['title'], 'idx_papers_title')
      t.index(['is_published'], 'idx_papers_published')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('papers')) {
    await knex.schema.dropTable('papers')
  }
}
