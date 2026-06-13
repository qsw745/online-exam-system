import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasRoles = await knex.schema.hasTable('roles')
  if (!hasRoles) return

  const hasSort = await knex.schema.hasColumn('roles', 'sort_order')
  if (!hasSort) {
    await knex.schema.alterTable('roles', t => {
      t.integer('sort_order').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasRoles = await knex.schema.hasTable('roles')
  if (!hasRoles) return

  const hasSort = await knex.schema.hasColumn('roles', 'sort_order')
  if (hasSort) {
    await knex.schema.alterTable('roles', t => {
      t.dropColumn('sort_order')
    })
  }
}
