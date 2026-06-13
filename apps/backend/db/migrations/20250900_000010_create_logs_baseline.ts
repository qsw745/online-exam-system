import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('logs'))) {
    await knex.schema.createTable('logs', t => {
      t.increments('id').unsigned().primary()
      t.string('log_type', 50).nullable() // 后续迁移会 UPDATE 这个字段
      t.string('level', 20).nullable()
      t.string('action', 200).nullable()
      t.integer('user_id').unsigned().nullable()
      t.string('ip', 45).nullable()
      t.text('message').nullable()
      t.json('meta').nullable()
      t.string('ua', 500).nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['log_type'], 'idx_logs_type')
      t.index(['level'], 'idx_logs_level')
      t.index(['user_id'], 'idx_logs_user')
      t.index(['created_at'], 'idx_logs_created_at')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('logs')) {
    await knex.schema.dropTable('logs')
  }
}
