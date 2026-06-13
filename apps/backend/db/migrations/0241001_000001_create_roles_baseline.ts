import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1) roles（若不存在则创建）
  if (!(await knex.schema.hasTable('roles'))) {
    await knex.schema.createTable('roles', t => {
      t.increments('id').unsigned().primary()
      t.string('name', 100).notNullable() // 角色中文名
      t.string('code', 100).notNullable().unique() // 角色编码（英文、唯一）
      t.string('description', 255).nullable()
      t.boolean('is_system').notNullable().defaultTo(false)
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['code'])
    })
  }

  // 2) user_roles（如你的后续迁移/代码用到用户-角色关系，兜底补上）
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

  // 3) role_menus（如你的 RBAC 通过“角色-菜单”授权，兜底补上）
  if (!(await knex.schema.hasTable('role_menus'))) {
    await knex.schema.createTable('role_menus', t => {
      t.increments('id').unsigned().primary()
      t.integer('role_id').unsigned().notNullable()
      t.integer('menu_id').unsigned().notNullable() // 指向 sys_menus.id
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
