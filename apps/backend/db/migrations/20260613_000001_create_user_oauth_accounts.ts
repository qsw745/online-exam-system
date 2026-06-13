import type { Knex } from 'knex'

async function getUsersIdColumnType(knex: Knex) {
  const db = (knex.client.config as any).connection.database
  const [rows] = await knex.raw(
    `
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
    LIMIT 1
    `,
    [db]
  )
  const type = rows?.[0]?.COLUMN_TYPE as string | undefined
  if (!type) throw new Error('Cannot introspect users.id COLUMN_TYPE from information_schema')
  return type
}

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('user_oauth_accounts')) return

  const usersIdType = await getUsersIdColumnType(knex)

  await knex.schema.createTable('user_oauth_accounts', table => {
    table.bigIncrements('id').primary()
    table.specificType('user_id', usersIdType).notNullable()
    table.string('provider', 32).notNullable()
    table.string('provider_user_id', 191).notNullable()
    table.string('email', 255).notNullable()
    table.string('display_name', 191).nullable()
    table.string('avatar_url', 1024).nullable()
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    table.timestamp('last_login_at').nullable()
    table.unique(['provider', 'provider_user_id'], 'uk_oauth_provider_user')
    table.index(['user_id'], 'idx_oauth_user')
    table.index(['email'], 'idx_oauth_email')
    table.foreign('user_id', 'fk_oauth_user').references('users.id').onDelete('CASCADE')
  })

  await knex.raw(
    `ALTER TABLE user_oauth_accounts MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_oauth_accounts')
}
