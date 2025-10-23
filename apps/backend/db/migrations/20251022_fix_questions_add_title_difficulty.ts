import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasTitle = await knex.schema.hasColumn('questions', 'title')
  if (!hasTitle) {
    await knex.schema.alterTable('questions', t => {
      t.string('title', 200).nullable().comment('题目标题/简述，列表用')
    })
    // 若你想把已有 content 的前 30~60 字自动回填到 title，可在此加一条 UPDATE（可选）：
    // await knex.raw("UPDATE questions SET title = IFNULL(title, LEFT(REPLACE(content, '\\n', ' '), 60))")
  }

  const hasDifficulty = await knex.schema.hasColumn('questions', 'difficulty')
  if (!hasDifficulty) {
    await knex.schema.alterTable('questions', t => {
      // 你项目里常用枚举若不同，可改成 tinyint(1) + 含义映射
      t.enum('difficulty', ['easy', 'medium', 'hard']).notNullable().defaultTo('medium')
    })
  }

  // 保险：如果 content / question_type 缺失就补上（不会覆盖已有）
  const hasContent = await knex.schema.hasColumn('questions', 'content')
  if (!hasContent) {
    await knex.schema.alterTable('questions', t => {
      t.text('content').notNullable()
    })
  }
  const hasQType = await knex.schema.hasColumn('questions', 'question_type')
  if (!hasQType) {
    await knex.schema.alterTable('questions', t => {
      t.enum('question_type', ['single_choice', 'multiple_choice', 'true_false', 'short_answer']).nullable()
    })
  }

  // 索引（列表排序/筛选常用）
  await knex.schema.alterTable('questions', t => {
    t.index(['question_type', 'difficulty', 'id'], 'idx_q_type_diff_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  // 通常不回滚生产列；如需回滚可按需删除：
  // await knex.schema.alterTable('questions', t => { t.dropIndex('idx_q_type_diff_id'); t.dropColumn('difficulty'); t.dropColumn('title'); })
}
