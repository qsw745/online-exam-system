import type { Knex } from 'knex'

const TABLE = 'workflow_templates'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return
  const hasApp = await knex.schema.hasColumn(TABLE, 'app_code')
  if (!hasApp) {
    await knex.schema.alterTable(TABLE, t => {
      t.string('app_code', 64).nullable().index()
      t.string('module_code', 64).nullable().index()
      t.string('form_key', 128).nullable().index()
      t.string('form_name', 255).nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return
  const hasApp = await knex.schema.hasColumn(TABLE, 'app_code')
  if (hasApp) {
    await knex.schema.alterTable(TABLE, t => {
      t.dropColumn('form_name')
      t.dropColumn('form_key')
      t.dropColumn('module_code')
      t.dropColumn('app_code')
    })
  }
}
