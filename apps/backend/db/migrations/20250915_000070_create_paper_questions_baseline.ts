import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('paper_questions'))) {
    await knex.schema.createTable('paper_questions', t => {
      t.increments('id').unsigned().primary()

      // 关联：试卷 & 题目（不强制 FK，避免不同环境约束不一致）
      t.integer('paper_id').unsigned().notNullable().index()
      t.integer('question_id').unsigned().notNullable().index()

      // 可选：分卷/大题/小节等标签，给后续迁移或业务使用
      t.string('section', 100).nullable()
      t.string('category', 100).nullable()

      // ⚠️ 不在这里建 order/score，留给 20250921_* 迁移去 ADD
      // t.integer('order_index').unsigned()  // ← 由后续迁移添加
      // t.decimal('score', 10, 2)            // ← 由后续迁移添加

      // 系统字段
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

      // 典型去重约束：同一试卷内一个题目只出现一次
      t.unique(['paper_id', 'question_id'], { indexName: 'uk_paper_question' })
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('paper_questions')) {
    await knex.schema.dropTable('paper_questions')
  }
}
