import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('users', 'email_verified')
  if (has) return

  await knex.schema.alterTable('users', table => {
    table.boolean('email_verified').notNullable().defaultTo(false)
    table.timestamp('email_verified_at').nullable()
  })

  // 存量用户视为已验证，避免开启验证后被锁在外面
  await knex('users').update({ email_verified: true, email_verified_at: knex.fn.now() })
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('users', 'email_verified')
  if (!has) return
  await knex.schema.alterTable('users', table => {
    table.dropColumn('email_verified')
    table.dropColumn('email_verified_at')
  })
}
