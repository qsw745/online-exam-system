import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('logs'))) {
    await knex.schema.createTable('logs', t => {
      t.increments('id').unsigned().primary()

      // 你后续迁移会用到的字段先兜底出来
      t.string('log_type', 50).nullable() // 20250910 会 UPDATE 这个字段
      t.string('level', 20).nullable() // 级别（info/warn/error），可选
      t.string('action', 200).nullable() // 动作/事件名，可选
      t.integer('user_id').unsigned().nullable() // 关联用户，可选
      t.string('ip', 45).nullable() // IPv4/IPv6
      t.text('message').nullable() // 文本消息
      t.json('meta').nullable() // 结构化附加信息
      t.string('ua', 500).nullable() // User-Agent，可选

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
