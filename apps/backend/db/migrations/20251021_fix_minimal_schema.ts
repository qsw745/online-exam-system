// migrations/20251021_fix_minimal_schema.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // ---------- tasks: 需要 exam_id、created_at ----------
  if (await knex.schema.hasTable('tasks')) {
    if (!(await knex.schema.hasColumn('tasks', 'exam_id'))) {
      await knex.schema.alterTable('tasks', t => {
        t.bigInteger('exam_id').nullable().index().comment('关联 exams.id')
      })
    }
    if (!(await knex.schema.hasColumn('tasks', 'created_at'))) {
      await knex.schema.alterTable('tasks', t => {
        t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      })
    }
  }

  // ---------- 任务分配表（我的任务用到） ----------
  if (!(await knex.schema.hasTable('task_assignments'))) {
    await knex.schema.createTable('task_assignments', t => {
      t.bigInteger('task_id').notNullable()
      t.bigInteger('user_id').notNullable()
      t.timestamp('assigned_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      t.primary(['task_id', 'user_id'])
      t.index(['user_id'], 'idx_task_assignments_user')
    })
  }

  if (!(await knex.schema.hasTable('task_department_assignments'))) {
    await knex.schema.createTable('task_department_assignments', t => {
      t.bigInteger('task_id').notNullable()
      t.bigInteger('department_id').notNullable() // 对应 organizations.id
      t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
      t.primary(['task_id', 'department_id'])
      t.index(['department_id'], 'idx_task_dept_assignments_department')
    })
  }

  // ---------- 通知（只用到未读数） ----------
  if (!(await knex.schema.hasTable('notifications'))) {
    await knex.schema.createTable('notifications', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').notNullable().index()
      t.string('title', 255).nullable()
      t.text('message').nullable()
      t.boolean('is_read').notNullable().defaultTo(false).index()
      t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    })
  }

  // ---------- exam_results 需要 paper_id 以支持 COALESCE(r.paper_id, e.paper_id) ----------
  if (await knex.schema.hasTable('exam_results')) {
    if (!(await knex.schema.hasColumn('exam_results', 'paper_id'))) {
      await knex.schema.alterTable('exam_results', t => {
        t.bigInteger('paper_id').nullable().comment('冗余的试卷ID')
      })
    }
  }

  // ---------- logs 补 details（之前报过缺 details） ----------
  if (await knex.schema.hasTable('logs')) {
    if (!(await knex.schema.hasColumn('logs', 'details'))) {
      await knex.schema.alterTable('logs', t => {
        t.text('details', 'longtext').nullable().comment('JSON 字符串细节')
      })
    }
  }

  // ---------- 菜单权限相关（查询用到了 role_menus / user_menus / unit_menus） ----------
  if (!(await knex.schema.hasTable('role_menus'))) {
    await knex.schema.createTable('role_menus', t => {
      t.bigInteger('role_id').notNullable()
      t.bigInteger('menu_id').notNullable()
      t.primary(['role_id', 'menu_id'])
      t.index(['menu_id'], 'idx_role_menus_menu')
    })
  }

  if (!(await knex.schema.hasTable('user_menus'))) {
    await knex.schema.createTable('user_menus', t => {
      t.bigInteger('user_id').notNullable()
      t.bigInteger('menu_id').notNullable()
      t.enum('permission_type', ['grant', 'deny']).notNullable().defaultTo('grant')
      t.primary(['user_id', 'menu_id'])
      t.index(['menu_id'], 'idx_user_menus_menu')
    })
  }

  // 查询里引用了 unit_menus 的这些列：sys_menu_id、unit_id、(name/title/path/component/icon/parent_sys_id/sort_order/menu_type/permission_code/redirect/meta/is_disabled)
  if (!(await knex.schema.hasTable('unit_menus'))) {
    await knex.schema.createTable('unit_menus', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('unit_id').notNullable().index() // 对应 organizations.id / org_id
      t.bigInteger('sys_menu_id').notNullable().index() // 对应 menus.id（系统菜单）
      t.string('name', 128).nullable()
      t.string('title', 256).nullable()
      t.string('path', 512).nullable()
      t.string('component', 256).nullable()
      t.string('icon', 128).nullable()
      t.bigInteger('parent_sys_id').nullable()
      t.integer('sort_order').nullable()
      t.enum('menu_type', ['menu', 'link', 'page', 'button']).nullable()
      t.string('permission_code', 128).nullable()
      t.string('redirect', 512).nullable()
      t.json('meta').nullable()
      t.boolean('is_disabled').notNullable().defaultTo(false).index()
      t.unique(['unit_id', 'sys_menu_id'], 'uk_unit_menus_unit_sys')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 只回滚“我们创建的”可选表；谨慎起见，生产环境一般不建议删这些
  if (await knex.schema.hasTable('unit_menus')) await knex.schema.dropTable('unit_menus')
  if (await knex.schema.hasTable('user_menus')) await knex.schema.dropTable('user_menus')
  if (await knex.schema.hasTable('role_menus')) await knex.schema.dropTable('role_menus')
  if (await knex.schema.hasTable('notifications')) await knex.schema.dropTable('notifications')
  if (await knex.schema.hasTable('task_department_assignments'))
    await knex.schema.dropTable('task_department_assignments')
  if (await knex.schema.hasTable('task_assignments')) await knex.schema.dropTable('task_assignments')

  // 列回滚（可选）
  if (await knex.schema.hasTable('exam_results')) {
    if (await knex.schema.hasColumn('exam_results', 'paper_id')) {
      await knex.schema.alterTable('exam_results', t => t.dropColumn('paper_id'))
    }
  }
  if (await knex.schema.hasTable('logs')) {
    if (await knex.schema.hasColumn('logs', 'details')) {
      await knex.schema.alterTable('logs', t => t.dropColumn('details'))
    }
  }
  if (await knex.schema.hasTable('tasks')) {
    if (await knex.schema.hasColumn('tasks', 'exam_id')) {
      await knex.schema.alterTable('tasks', t => t.dropColumn('exam_id'))
    }
    // created_at 通常不回滚，避免影响其它依赖
  }
}
