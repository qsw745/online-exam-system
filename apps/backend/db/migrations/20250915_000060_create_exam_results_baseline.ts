import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('exam_results'))) {
    await knex.schema.createTable('exam_results', t => {
      t.increments('id').unsigned().primary()

      // 关联信息（不强制 FK，避免不同环境约束不一致）
      t.integer('exam_id').unsigned().notNullable().index()
      t.integer('user_id').unsigned().notNullable().index()

      // 成绩&状态（给后续迁移留扩展空间）
      t.integer('total_score').unsigned().nullable()
      t.integer('objective_score').unsigned().nullable()
      t.integer('subjective_score').unsigned().nullable()
      t.boolean('passed').nullable() // 留给后续迁移决定规则
      t.integer('duration_seconds').unsigned().nullable()

      // 过程与答案
      t.timestamp('started_at').nullable()
      t.timestamp('submitted_at').nullable()
      t.json('answers').nullable() // 存答题明细（选择题/填空题等）
      t.text('remarks').nullable() // 考务备注

      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

      // 常用复合索引
      t.index(['exam_id', 'user_id'], 'idx_exam_results_exam_user')
      t.index(['submitted_at'], 'idx_exam_results_submitted_at')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('exam_results')) {
    await knex.schema.dropTable('exam_results')
  }
}
