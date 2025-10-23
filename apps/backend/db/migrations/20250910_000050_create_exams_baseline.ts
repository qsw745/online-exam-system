import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('exams'))) {
    await knex.schema.createTable('exams', t => {
      t.increments('id').unsigned().primary()

      // 基础信息（按常见字段兜底，后续迁移可自由 ALTER）
      t.string('title', 200).notNullable()
      t.text('description').nullable()

      // 与试卷/组织的关联（可选，后续如果你的迁移会加 FK，这里只做整型占位）
      t.integer('paper_id').unsigned().nullable().index()
      t.integer('org_id').unsigned().nullable().index()
      t.integer('creator_id').unsigned().nullable().index()

      // 考试时间与时长
      t.timestamp('start_time').nullable()
      t.timestamp('end_time').nullable()
      t.integer('duration_minutes').unsigned().nullable()

      // 计分/可见性等（留出位，方便后续迁移增改）
      t.integer('total_score').unsigned().nullable()
      t.boolean('is_published').notNullable().defaultTo(false)

      // 系统字段
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

      // 常用索引
      t.index(['title'], 'idx_exams_title')
      t.index(['start_time'], 'idx_exams_start_time')
      t.index(['end_time'], 'idx_exams_end_time')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('exams')) {
    await knex.schema.dropTable('exams')
  }
}
