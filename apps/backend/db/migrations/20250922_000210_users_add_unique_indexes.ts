import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('users'))) return
  await knex.schema.alterTable('users', t => {
    try {
      t.unique(['email'], 'uk_users_email')
    } catch {}
    try {
      t.unique(['username'], 'uk_users_username')
    } catch {}
  })
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('users'))) return
  await knex.schema.alterTable('users', t => {
    try {
      t.dropUnique(['email'], 'uk_users_email')
    } catch {}
    try {
      t.dropUnique(['username'], 'uk_users_username')
    } catch {}
  })
}
