import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('refresh_tokens')
  if (!has) {
    await knex.schema.createTable('refresh_tokens', t => {
      t.bigIncrements('id').unsigned().primary()
      t.bigint('user_id').unsigned().notNullable().index('idx_rt_user')
      t.string('jti', 128).notNullable().unique('uniq_rt_jti')
      t.string('token_hash', 255).notNullable()
      t.string('user_agent', 255).nullable()
      t.string('ip', 64).nullable()
      t.dateTime('expires_at').notNullable().index('idx_rt_expires')
      t.boolean('revoked').notNullable().defaultTo(false).index('idx_rt_revoked')
      t.string('replaced_by_jti', 128).nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens')
}
