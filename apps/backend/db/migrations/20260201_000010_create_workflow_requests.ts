import type { Knex } from 'knex'

const REQUESTS = 'workflow_requests'
const APPROVALS = 'workflow_approvals'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(REQUESTS))) {
    await knex.schema.createTable(REQUESTS, t => {
      t.increments('id').unsigned().primary()
      t.string('entity_type', 50).notNullable()
      t.bigInteger('entity_id').unsigned().notNullable()
      t.string('title', 255).notNullable()
      t.enu('status', ['pending', 'approved', 'rejected', 'canceled']).notNullable().defaultTo('pending')
      t.integer('required_approvals').unsigned().notNullable().defaultTo(1)
      t.integer('approved_count').unsigned().notNullable().defaultTo(0)
      t.integer('rejected_count').unsigned().notNullable().defaultTo(0)
      t.bigInteger('created_by').unsigned().notNullable()
      t.text('meta', 'mediumtext').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['entity_type', 'entity_id'], 'idx_workflow_entity')
      t.index(['status', 'created_at'], 'idx_workflow_status_created_at')
    })
  }

  if (!(await knex.schema.hasTable(APPROVALS))) {
    await knex.schema.createTable(APPROVALS, t => {
      t.increments('id').unsigned().primary()
      t.integer('request_id').unsigned().notNullable()
      t.bigInteger('user_id').unsigned().notNullable()
      t.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending')
      t.text('comment', 'mediumtext').nullable()
      t.timestamp('decided_at').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['request_id', 'user_id'], 'uniq_workflow_request_user')
      t.index(['request_id', 'status'], 'idx_workflow_approval_request_status')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(APPROVALS)) {
    await knex.schema.dropTable(APPROVALS)
  }
  if (await knex.schema.hasTable(REQUESTS)) {
    await knex.schema.dropTable(REQUESTS)
  }
}
