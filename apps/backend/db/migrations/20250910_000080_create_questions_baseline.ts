import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('questions'))) {
    await knex.schema.createTable('questions', t => {
      t.increments('id').unsigned().primary()
      // 题型：单选/多选/判断/简答… 先用字符串兜底（你的历史迁移会从这里拷贝到快照列）
      t.string('question_type', 50).notNullable().defaultTo('single')
      t.text('content').notNullable()
      t.json('options').nullable() // 选择题选项（JSON）
      t.text('correct_answer').nullable() // 简答/填空题可用文本
      t.integer('score').unsigned().nullable()
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['question_type'], 'idx_questions_type')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('questions')) {
    await knex.schema.dropTable('questions')
  }
}
