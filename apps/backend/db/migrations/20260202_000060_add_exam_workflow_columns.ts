import type { Knex } from 'knex'

const TABLE = 'exams'

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    const hasRequiresReview = await knex.schema.hasColumn(TABLE, 'workflow_requires_review')
    if (!hasRequiresReview) {
      await knex.schema.alterTable(TABLE, t => {
        t.boolean('workflow_requires_review').notNullable().defaultTo(false)
        t.integer('workflow_template_id').unsigned().nullable().index()
        t.text('workflow_form_data', 'mediumtext').nullable()
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) {
    const hasRequiresReview = await knex.schema.hasColumn(TABLE, 'workflow_requires_review')
    if (hasRequiresReview) {
      await knex.schema.alterTable(TABLE, t => {
        t.dropColumn('workflow_form_data')
        t.dropColumn('workflow_template_id')
        t.dropColumn('workflow_requires_review')
      })
    }
  }
}
