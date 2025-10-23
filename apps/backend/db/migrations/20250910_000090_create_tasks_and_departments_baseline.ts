import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1) tasks：提供 id 主键类型给后续迁移读取
  if (!(await knex.schema.hasTable('tasks'))) {
    await knex.schema.createTable('tasks', t => {
      t.increments('id').unsigned().primary() // ← 常见是 INT UNSIGNED 自增
      t.string('title', 200).notNullable()
      t.text('description').nullable()
      t.enu('status', ['todo', 'doing', 'done']).notNullable().defaultTo('todo')
      t.integer('assignee_id').unsigned().nullable().index()
      t.timestamp('due_at').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['status'], 'idx_tasks_status')
      t.index(['due_at'], 'idx_tasks_due')
    })
  }

  // 2) departments：多数“任务-部门分配”会用到部门主表
  if (!(await knex.schema.hasTable('departments'))) {
    await knex.schema.createTable('departments', t => {
      t.increments('id').unsigned().primary()
      t.integer('parent_id').unsigned().nullable().index()
      t.string('name', 200).notNullable()
      t.string('code', 100).nullable().unique()
      t.integer('sort_order').nullable()
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['name'], 'idx_departments_name')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('departments')) {
    await knex.schema.dropTable('departments')
  }
  if (await knex.schema.hasTable('tasks')) {
    await knex.schema.dropTable('tasks')
  }
}
