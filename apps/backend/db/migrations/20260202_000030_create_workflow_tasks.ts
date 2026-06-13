import type { Knex } from 'knex'

const TABLE = 'workflow_tasks'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) {
    await knex.schema.createTable(TABLE, t => {
      t.increments('id').unsigned().primary()
      t.integer('instance_id').unsigned().notNullable()
      t.string('node_id', 64).notNullable()
      t.string('node_name', 255).notNullable()
      t.bigInteger('assignee_id').unsigned().notNullable()
      t.enu('status', ['pending', 'approved', 'rejected', 'canceled']).notNullable().defaultTo('pending')
      t.text('comment', 'mediumtext').nullable()
      t.timestamp('decided_at').nullable()
      t.text('meta', 'mediumtext').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['assignee_id', 'status'], 'idx_workflow_task_assignee_status')
      t.index(['instance_id', 'node_id'], 'idx_workflow_task_instance_node')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    await knex.schema.dropTable(TABLE)
  }
}
