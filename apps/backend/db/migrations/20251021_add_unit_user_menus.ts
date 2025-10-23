// migrations/20251021_add_unit_user_menus.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasUnit = await knex.schema.hasTable('unit_menus')
  if (!hasUnit) {
    await knex.schema.createTable('unit_menus', t => {
      t.increments('id').primary()
      t.integer('unit_id').notNullable()
      t.integer('sys_menu_id').notNullable() // 指向系统菜单 menus.id
      t.string('name', 128).nullable()
      t.string('title', 128).nullable()
      t.string('path', 255).nullable()
      t.string('component', 255).nullable()
      t.string('icon', 64).nullable()
      t.integer('parent_sys_id').nullable()
      t.integer('sort_order').nullable()
      t.string('menu_type', 16).nullable() // 'menu' | 'link' | 'page'
      t.string('permission_code', 128).nullable()
      t.string('redirect', 255).nullable()
      t.text('meta').nullable()
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.index(['unit_id', 'sys_menu_id'], 'idx_unit_sys_menu')
    })
  }

  const hasUser = await knex.schema.hasTable('user_menus')
  if (!hasUser) {
    await knex.schema.createTable('user_menus', t => {
      t.increments('id').primary()
      t.integer('user_id').notNullable()
      t.integer('menu_id').notNullable() // 指向系统菜单 menus.id
      t.enum('permission_type', ['grant', 'deny']).notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.index(['user_id', 'menu_id'], 'idx_user_menu')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('user_menus')) await knex.schema.dropTable('user_menus')
  if (await knex.schema.hasTable('unit_menus')) await knex.schema.dropTable('unit_menus')
}
