import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // organizations —— 仅当不存在时创建
  if (!(await knex.schema.hasTable('organizations'))) {
    await knex.schema.createTable('organizations', t => {
      t.increments('id').unsigned().primary() // ✅ 正确写法
      t.integer('parent_id').unsigned().nullable().index()
      t.string('name', 200).notNullable()
      t.string('code', 100).nullable().unique()
      t.integer('sort_order').nullable()
      // boolean 在 MySQL 会映射为 TINYINT(1)
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  // sys_menus —— 仅当不存在时创建
  if (!(await knex.schema.hasTable('sys_menus'))) {
    await knex.schema.createTable('sys_menus', t => {
      t.increments('id').unsigned().primary() // ✅ 正确写法
      t.integer('parent_id').unsigned().nullable().index()
      t.string('name', 100).nullable().index()
      t.string('title', 200).nullable()
      t.string('path', 255).nullable()
      t.string('component', 255).nullable()
      t.string('icon', 100).nullable()
      t.integer('sort_order').nullable()
      // ✅ Knex 没有 t.tinyint：用 specificType 定义
      t.specificType('level', 'TINYINT UNSIGNED').nullable()
      t.boolean('is_hidden').notNullable().defaultTo(false)
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.boolean('is_system').notNullable().defaultTo(false)
      t.enu('menu_type', ['page', 'menu', 'button', 'link']).nullable().defaultTo('page')
      t.string('permission_code', 100).nullable()
      t.string('redirect', 255).nullable()
      t.json('meta').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  // ⚠️ 不在此处创建 unit_menus（已有 20240912_* 迁移负责）
}

export async function down(knex: Knex): Promise<void> {
  // baseline 通常不回滚；如需回滚，注意依赖顺序
  if (await knex.schema.hasTable('sys_menus')) {
    await knex.schema.dropTable('sys_menus')
  }
  if (await knex.schema.hasTable('organizations')) {
    await knex.schema.dropTable('organizations')
  }
}
