import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasLeaderboards = await knex.schema.hasTable('leaderboards')
  if (!hasLeaderboards) {
    await knex.schema.createTable('leaderboards', t => {
      t.bigIncrements('id').primary()
      t.string('name', 120).notNullable().comment('榜单名称')
      t.string('description', 500).nullable()
      t.enum('category', ['all', 'practice', 'exam', 'weekly', 'monthly']).notNullable().defaultTo('all')
      t.enum('type', ['score', 'count', 'streak', 'time']).notNullable().defaultTo('score')
      t.boolean('is_active').notNullable().defaultTo(true)
      t.timestamp('start_at').nullable()
      t.timestamp('end_at').nullable()
      t.timestamps(true, true)

      t.index(['is_active', 'created_at'], 'idx_leaderboard_active_created')
      t.index(['category', 'type'], 'idx_leaderboard_cat_type')
    })

    // 可选：初始化一条默认榜单，避免前端空态
    await knex('leaderboards').insert([
      { name: '综合积分榜', description: '全站积分排行', category: 'all', type: 'score', is_active: 1 },
    ])
  }

  const hasEntries = await knex.schema.hasTable('leaderboard_entries')
  if (!hasEntries) {
    await knex.schema.createTable('leaderboard_entries', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('leaderboard_id').unsigned().notNullable()
      t.bigInteger('user_id').unsigned().notNullable()
      t.decimal('score', 18, 4).notNullable().defaultTo(0)
      t.integer('rank').nullable()
      t.json('meta').nullable().comment('扩展数据：如来源、维度等')
      t.timestamp('recorded_at').nullable().defaultTo(knex.fn.now())
      t.timestamps(true, true)

      t.unique(['leaderboard_id', 'user_id'], { indexName: 'uq_lb_user' })
      t.index(['leaderboard_id', 'score'], 'idx_lb_score')
      t.index(['leaderboard_id', 'rank'], 'idx_lb_rank')
      t.index(['user_id'], 'idx_lb_user')

      // 如需外键，可按需放开
      // t.foreign('leaderboard_id').references('id').inTable('leaderboards').onDelete('CASCADE')
      // t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('leaderboard_entries')
  await knex.schema.dropTableIfExists('leaderboards')
}
