import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('roles'))) {
    await knex.schema.createTable('roles', t => {
      t.increments('id').unsigned().primary()
      t.string('name', 100).notNullable()
      t.string('code', 100).notNullable().unique()
      t.string('description', 255).nullable()
      t.boolean('is_system').notNullable().defaultTo(false)
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['code'])
    })
  }

  if (!(await knex.schema.hasTable('user_roles'))) {
    await knex.schema.createTable('user_roles', t => {
      t.increments('id').unsigned().primary()
      t.integer('user_id').unsigned().notNullable()
      t.integer('role_id').unsigned().notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['user_id', 'role_id'], { indexName: 'uk_user_role' })
      t.index(['role_id'], 'idx_user_roles_role')
    })
  }

  if (!(await knex.schema.hasTable('role_menus'))) {
    await knex.schema.createTable('role_menus', t => {
      t.increments('id').unsigned().primary()
      t.integer('role_id').unsigned().notNullable()
      t.integer('menu_id').unsigned().notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['role_id', 'menu_id'], { indexName: 'uk_role_menu' })
      t.index(['menu_id'], 'idx_role_menus_menu')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('role_menus')) await knex.schema.dropTable('role_menus')
  if (await knex.schema.hasTable('user_roles')) await knex.schema.dropTable('user_roles')
  if (await knex.schema.hasTable('roles')) await knex.schema.dropTable('roles')
}
