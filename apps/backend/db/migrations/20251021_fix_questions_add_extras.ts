import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasExplanation = await knex.schema.hasColumn('questions', 'explanation')
  if (!hasExplanation) {
    await knex.schema.alterTable('questions', t => {
      t.text('explanation').nullable().comment('题目解析')
    })
  }

  const hasKnowledgePoints = await knex.schema.hasColumn('questions', 'knowledge_points')
  if (!hasKnowledgePoints) {
    // 若 MySQL 8 可用 JSON，则也可 t.json('knowledge_points')
    await knex.schema.alterTable('questions', t => {
      t.json('knowledge_points').nullable().comment('知识点（JSON 数组）')
    })
  }

  const hasTags = await knex.schema.hasColumn('questions', 'tags')
  if (!hasTags) {
    await knex.schema.alterTable('questions', t => {
      t.json('tags').nullable().comment('标签（JSON 数组）')
    })
  }

  // 保险起见，如果没有这些典型字段也补上（不影响已有环境）
  const hasOptions = await knex.schema.hasColumn('questions', 'options')
  if (!hasOptions) {
    await knex.schema.alterTable('questions', t => {
      t.json('options').nullable().comment('选项（JSON）')
    })
  }

  const hasCorrect = await knex.schema.hasColumn('questions', 'correct_answer')
  if (!hasCorrect) {
    await knex.schema.alterTable('questions', t => {
      t.json('correct_answer').nullable().comment('标准答案（JSON 或字符串）')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 一般不回滚生产字段，按需删除：
  // await knex.schema.alterTable('questions', t => { t.dropColumn('explanation'); t.dropColumn('knowledge_points'); t.dropColumn('tags'); })
}
