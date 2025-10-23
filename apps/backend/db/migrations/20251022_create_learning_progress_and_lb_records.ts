import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // ===== 1) 学习进度表 =====
  const hasLP = await knex.schema.hasTable('learning_progress')
  if (!hasLP) {
    await knex.schema.createTable('learning_progress', t => {
      t.bigIncrements('id').primary()
      t.bigInteger('user_id').unsigned().notNullable().comment('用户')
      t.bigInteger('subject_id').unsigned().nullable().comment('科目，可空')
      t.integer('total_questions').notNullable().defaultTo(0).comment('总做题数')
      t.integer('correct_answers').notNullable().defaultTo(0).comment('答对题数')
      t.integer('time_spent').notNullable().defaultTo(0).comment('学习时长(秒)')
      t.decimal('accuracy_rate', 6, 3).notNullable().defaultTo(0).comment('正确率 0~1')
      t.date('study_date').notNullable().comment('学习日期')
      t.timestamps(true, true)

      // 常用查询索引
      t.index(['user_id', 'study_date'], 'idx_lp_user_date')
      t.index(['user_id', 'subject_id'], 'idx_lp_user_subject')
    })
  }

  // ===== 2) 排行榜记录视图或表 =====
  // 你的代码在查：leaderboard_records（并要求有 rank_position 列）
  // 我们之前建的是 leaderboard_entries，列为 rank
  // -> 这里用 VIEW 做一层别名映射，兼容现有查询
  const hasEntries = await knex.schema.hasTable('leaderboard_entries')
  if (hasEntries) {
    // 用 VIEW 映射 rank -> rank_position
    await knex.raw(`
      CREATE OR REPLACE VIEW leaderboard_records AS
      SELECT
        id,
        leaderboard_id,
        user_id,
        score,
        \`rank\` AS rank_position,
        meta,
        recorded_at,
        created_at,
        updated_at
      FROM leaderboard_entries
    `)
  } else {
    // 保险：如果你没有跑我上一步创建 entries 的迁移，这里直接建 records 表（字段对齐当前查询）
    const hasRecords = await knex.schema.hasTable('leaderboard_records')
    if (!hasRecords) {
      await knex.schema.createTable('leaderboard_records', t => {
        t.bigIncrements('id').primary()
        t.bigInteger('leaderboard_id').unsigned().notNullable()
        t.bigInteger('user_id').unsigned().notNullable()
        t.decimal('score', 18, 4).notNullable().defaultTo(0)
        t.integer('rank_position').nullable()
        t.json('meta').nullable()
        t.timestamp('recorded_at').nullable().defaultTo(knex.fn.now())
        t.timestamps(true, true)

        t.unique(['leaderboard_id', 'user_id'], { indexName: 'uq_lbrec_user' })
        t.index(['leaderboard_id', 'score'], 'idx_lbrec_score')
        t.index(['leaderboard_id', 'rank_position'], 'idx_lbrec_rank')
        t.index(['user_id'], 'idx_lbrec_user')
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚顺序注意先删 view/从表
  try {
    await knex.raw('DROP VIEW IF EXISTS leaderboard_records')
  } catch {}
  await knex.schema.dropTableIfExists('leaderboard_records')
  await knex.schema.dropTableIfExists('learning_progress')
}
