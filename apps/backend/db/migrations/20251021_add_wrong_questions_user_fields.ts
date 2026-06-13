import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('wrong_questions')

  if (!hasTable) {
    // 不存在就新建（推荐结构）
    await knex.schema.createTable('wrong_questions', t => {
      t.bigIncrements('id').primary()

      t.bigInteger('user_id').unsigned().notNullable()
      t.bigInteger('question_id').unsigned().notNullable()

      // 是否已掌握：0=未掌握, 1=已掌握
      t.boolean('is_mastered').notNullable().defaultTo(false)

      // 统计字段（可选）
      t.integer('wrong_count').notNullable().defaultTo(1)
      t.integer('correct_count').notNullable().defaultTo(0)
      t.timestamp('last_practiced_at').nullable()

      t.timestamps(true, true)

      // 约束 & 索引
      t.unique(['user_id', 'question_id'], { indexName: 'uq_wrong_user_question' })
      t.index(['user_id', 'is_mastered'], 'idx_wrong_user_mastered')
      t.index(['user_id'], 'idx_wrong_user')
      t.index(['question_id'], 'idx_wrong_question')

      // 如果你已经有 users / questions 表，建议加外键（如需可取消注释）
      // t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      // t.foreign('question_id').references('id').inTable('questions').onDelete('CASCADE')
    })
    return
  }

  // 已存在：逐列补齐（保持幂等）
  const hasUserId = await knex.schema.hasColumn('wrong_questions', 'user_id')
  if (!hasUserId) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.bigInteger('user_id').unsigned().nullable().after('id')
    })
    // 视你的历史数据情况做回填，这里不强制；若无数据可直接改为 not null
    await knex.schema.alterTable('wrong_questions', t => {
      t.bigInteger('user_id').unsigned().notNullable().alter()
    })
    await knex.schema.alterTable('wrong_questions', t => {
      t.index(['user_id'], 'idx_wrong_user')
    })
  }

  const hasQuestionId = await knex.schema.hasColumn('wrong_questions', 'question_id')
  if (!hasQuestionId) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.bigInteger('question_id').unsigned().nullable()
    })
    await knex.schema.alterTable('wrong_questions', t => {
      t.bigInteger('question_id').unsigned().notNullable().alter()
    })
    await knex.schema.alterTable('wrong_questions', t => {
      t.index(['question_id'], 'idx_wrong_question')
    })
  }

  const hasIsMastered = await knex.schema.hasColumn('wrong_questions', 'is_mastered')
  if (!hasIsMastered) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.boolean('is_mastered').notNullable().defaultTo(false)
    })
    await knex.schema.alterTable('wrong_questions', t => {
      t.index(['user_id', 'is_mastered'], 'idx_wrong_user_mastered')
    })
  }

  // 辅助统计列（可选）
  const hasWrongCount = await knex.schema.hasColumn('wrong_questions', 'wrong_count')
  if (!hasWrongCount) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.integer('wrong_count').notNullable().defaultTo(1)
    })
  }
  const hasCorrectCount = await knex.schema.hasColumn('wrong_questions', 'correct_count')
  if (!hasCorrectCount) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.integer('correct_count').notNullable().defaultTo(0)
    })
  }
  const hasLastPracticed = await knex.schema.hasColumn('wrong_questions', 'last_practiced_at')
  if (!hasLastPracticed) {
    await knex.schema.alterTable('wrong_questions', t => {
      t.timestamp('last_practiced_at').nullable()
    })
  }

  // 唯一约束（若已有重复数据会失败；如担心可跳过或先清洗）
  // try { await knex.raw('ALTER TABLE `wrong_questions` ADD UNIQUE KEY `uq_wrong_user_question` (`user_id`,`question_id`)') } catch {}
}

export async function down(knex: Knex): Promise<void> {
  // 回滚只做最小化处理：不建议直接删表，避免数据丢失
  // 如果一定要回滚，可按需删除索引或列
  // await knex.schema.dropTableIfExists('wrong_questions')
}
