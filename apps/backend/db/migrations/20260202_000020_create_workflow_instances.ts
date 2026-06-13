import type { Knex } from 'knex'

const TABLE = 'workflow_instances'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) {
    await knex.schema.createTable(TABLE, t => {
      t.increments('id').unsigned().primary()
      t.integer('template_id').unsigned().notNullable()
      t.string('entity_type', 64).notNullable()
      t.bigInteger('entity_id').unsigned().notNullable()
      t.enu('status', ['running', 'approved', 'rejected', 'canceled']).notNullable().defaultTo('running')
      t.text('current_nodes', 'mediumtext').notNullable()
      t.text('payload', 'mediumtext').nullable()
      t.bigInteger('created_by').unsigned().notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['entity_type', 'entity_id'], 'idx_workflow_instance_entity')
      t.index(['status', 'created_at'], 'idx_workflow_instance_status_created_at')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    await knex.schema.dropTable(TABLE)
  }
}
