// migrations/20251021_fill_missing_tables_and_columns.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1) role_menus —— 角色 ↔ 菜单 关联
  if (!(await knex.schema.hasTable('role_menus'))) {
    await knex.schema.createTable('role_menus', t => {
      t.increments('id').primary()
      t.integer('role_id').notNullable() // -> roles.id
      t.integer('menu_id').notNullable() // -> menus.id
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['role_id', 'menu_id'], 'uniq_role_menu')
      t.index(['role_id'], 'idx_role_menus_role')
      t.index(['menu_id'], 'idx_role_menus_menu')
    })
  }

  // 2) unit_menus（机构对系统菜单的覆盖；你已补过，做存在判断，避免重复）
  if (!(await knex.schema.hasTable('unit_menus'))) {
    await knex.schema.createTable('unit_menus', t => {
      t.increments('id').primary()
      t.integer('unit_id').notNullable() // -> organizations.id
      t.integer('sys_menu_id').notNullable() // -> menus.id
      t.string('name', 128)
      t.string('title', 128)
      t.string('path', 255)
      t.string('component', 255)
      t.string('icon', 64)
      t.integer('parent_sys_id')
      t.integer('sort_order')
      t.string('menu_type', 16) // 'menu'|'link'|'page'
      t.string('permission_code', 128)
      t.string('redirect', 255)
      t.text('meta')
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.index(['unit_id', 'sys_menu_id'], 'idx_unit_sys_menu')
    })
  }

  // 3) user_menus（用户对单个菜单的授权/拒绝）
  if (!(await knex.schema.hasTable('user_menus'))) {
    await knex.schema.createTable('user_menus', t => {
      t.increments('id').primary()
      t.integer('user_id').notNullable() // -> users.id
      t.integer('menu_id').notNullable() // -> menus.id
      t.enum('permission_type', ['grant', 'deny']).notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['user_id', 'menu_id'], 'uniq_user_menu')
      t.index(['user_id'], 'idx_user_menu_user')
    })
  }

  // 4) notifications（未读数接口用到了 user_id + is_read=false）
  if (!(await knex.schema.hasTable('notifications'))) {
    await knex.schema.createTable('notifications', t => {
      t.increments('id').primary()
      t.integer('user_id').notNullable() // -> users.id
      t.string('title', 255).notNullable().defaultTo('')
      t.text('content')
      t.boolean('is_read').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.index(['user_id', 'is_read'], 'idx_notifications_user_unread')
    })
  }

  // 5) tasks（仪表盘/我的任务查询里用到了 t.status, t.exam_id, t.created_at）
  if (!(await knex.schema.hasTable('tasks'))) {
    await knex.schema.createTable('tasks', t => {
      t.increments('id').primary()
      t.string('title', 255).notNullable().defaultTo('')
      t.text('description')
      t.integer('exam_id').nullable() // -> exams.id
      t.enum('status', ['pending', 'in_progress', 'completed']).notNullable().defaultTo('pending')
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').nullable()
      t.index(['status'], 'idx_tasks_status')
      t.index(['created_at'], 'idx_tasks_created_at')
    })
  }

  // 6) task_assignments（任务 ↔ 用户）
  if (!(await knex.schema.hasTable('task_assignments'))) {
    await knex.schema.createTable('task_assignments', t => {
      t.increments('id').primary()
      t.integer('task_id').notNullable() // -> tasks.id
      t.integer('user_id').notNullable() // -> users.id
      t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['task_id', 'user_id'], 'uniq_task_user')
      t.index(['user_id'], 'idx_task_assignments_user')
      t.index(['task_id'], 'idx_task_assignments_task')
    })
  }

  // 7) task_department_assignments（任务 ↔ 组织/部门）
  if (!(await knex.schema.hasTable('task_department_assignments'))) {
    await knex.schema.createTable('task_department_assignments', t => {
      t.increments('id').primary()
      t.integer('task_id').notNullable() // -> tasks.id
      t.integer('department_id').notNullable() // -> organizations.id
      t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['task_id', 'department_id'], 'uniq_task_department')
      t.index(['department_id'], 'idx_task_dept_department')
      t.index(['task_id'], 'idx_task_dept_task')
    })
  }

  // 8) exam_results.paper_id（结果列表 JOIN 用到了 r.paper_id）
  if (!(await knex.schema.hasColumn('exam_results', 'paper_id'))) {
    await knex.schema.alterTable('exam_results', t => {
      t.integer('paper_id').nullable() // -> papers.id
    })
    // 可选：把历史数据按 exam 的 paper_id 回填一遍（能 JOIN 出标题）
    try {
      await knex.raw(`
        UPDATE exam_results r
        LEFT JOIN exams e ON e.id = r.exam_id
        SET r.paper_id = e.paper_id
        WHERE r.paper_id IS NULL
      `)
    } catch {}
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚按依赖顺序删除（可选；一般不建议在生产回滚这类结构表）
  if (await knex.schema.hasColumn('exam_results', 'paper_id')) {
    await knex.schema.alterTable('exam_results', t => t.dropColumn('paper_id'))
  }
  if (await knex.schema.hasTable('task_department_assignments')) {
    await knex.schema.dropTable('task_department_assignments')
  }
  if (await knex.schema.hasTable('task_assignments')) {
    await knex.schema.dropTable('task_assignments')
  }
  if (await knex.schema.hasTable('tasks')) {
    await knex.schema.dropTable('tasks')
  }
  if (await knex.schema.hasTable('notifications')) {
    await knex.schema.dropTable('notifications')
  }
  if (await knex.schema.hasTable('user_menus')) {
    await knex.schema.dropTable('user_menus')
  }
  if (await knex.schema.hasTable('unit_menus')) {
    await knex.schema.dropTable('unit_menus')
  }
  if (await knex.schema.hasTable('role_menus')) {
    await knex.schema.dropTable('role_menus')
  }
}
