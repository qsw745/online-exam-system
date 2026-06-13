// db/migrations/20250910_add_logs_defaults.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`UPDATE logs SET log_type='system' WHERE log_type IS NULL OR log_type=''`)
  await knex.raw(`UPDATE logs SET level='info'   WHERE level IS NULL OR level=''`)

  await knex.schema.alterTable('logs', t => {
    t.string('log_type', 20).notNullable().defaultTo('system').alter()
    t.string('level', 10).notNullable().defaultTo('info').alter()
  })
}

export async function down(knex: Knex): Promise<void> {
  // 这里保守回滚：去掉默认值（按需）
  await knex.schema.alterTable('logs', t => {
    t.string('log_type', 20).nullable().defaultTo(null).alter()
    t.string('level', 10).nullable().defaultTo(null).alter()
  })
}
