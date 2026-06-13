import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', t => {
      t.increments('id').unsigned().primary()
      t.string('username', 100).notNullable().unique()
      t.string('email', 200).nullable().unique()
      t.string('password_hash', 255).notNullable()
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['username'], 'idx_users_username')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('users')) {
    await knex.schema.dropTable('users')
  }
}
