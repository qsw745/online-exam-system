// migrations/20251021_add_user_role.ts
import type { Knex } from 'knex'

const TBL = 'users'

export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn(TBL, 'role')
  if (!has) {
    await knex.schema.alterTable(TBL, t => {
      t.string('role', 16).notNullable().defaultTo('student') // 'admin' | 'teacher' | 'student'
    })
  }
  await knex(TBL)
    .whereNull('role')
    .update({ role: 'student' })
    .catch(() => {})
  await knex(TBL)
    .where('role', '')
    .update({ role: 'student' })
    .catch(() => {})
  // 可选：索引
  // await knex.schema.alterTable(TBL, t => t.index(['role'], 'idx_users_role'));
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn(TBL, 'role')
  if (has) {
    await knex.schema.alterTable(TBL, t => t.dropColumn('role'))
  }
}
