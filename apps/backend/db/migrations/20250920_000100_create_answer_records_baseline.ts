import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('answer_records'))) {
    await knex.schema.createTable('answer_records', t => {
      t.increments('id').unsigned().primary()

      // 关联（不强制外键，避免环境差异）
      t.integer('exam_id').unsigned().notNullable().index()
      t.integer('paper_id').unsigned().nullable().index()
      t.integer('user_id').unsigned().notNullable().index()
      t.integer('question_id').unsigned().notNullable().index()

      // 作答内容（为后续迁移留空间）
      t.string('question_type', 50).nullable()
      t.text('answer_text').nullable() // 主观题答案
      t.json('answer_options').nullable() // 客观题选择
      t.boolean('is_correct').nullable()
      t.decimal('score', 10, 2).nullable()

      // 时间信息
      t.timestamp('started_at').nullable()
      t.timestamp('answered_at').nullable()

      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

      // 典型去重：同一考试同一人同一题一条记录（如你允许多次作答，可移除或改为含次数的唯一键）
      t.unique(['exam_id', 'user_id', 'question_id'], { indexName: 'uk_exam_user_question' })
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('answer_records')) {
    await knex.schema.dropTable('answer_records')
  }
}
