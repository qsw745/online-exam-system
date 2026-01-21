import type { Knex } from 'knex'

const TABLE = 'workflow_templates'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) {
    await knex.schema.createTable(TABLE, t => {
      t.increments('id').unsigned().primary()
      t.string('name', 255).notNullable()
      t.string('entity_type', 64).notNullable()
      t.integer('version').unsigned().notNullable().defaultTo(1)
      t.enu('status', ['draft', 'published']).notNullable().defaultTo('draft')
      t.text('definition', 'mediumtext').notNullable()
      t.bigInteger('created_by').unsigned().notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['name', 'version'], 'uniq_workflow_template_name_version')
      t.index(['entity_type', 'status'], 'idx_workflow_template_entity_status')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    await knex.schema.dropTable(TABLE)
  }
}
