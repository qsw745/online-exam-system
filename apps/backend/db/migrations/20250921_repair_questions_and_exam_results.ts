// apps/backend/knex/migrations/20250921_repair_questions_and_exam_results.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // questions.question_type
    const hasQuestionType = await knex.schema.hasColumn('questions', 'question_type')
    if (!hasQuestionType) {
        await knex.schema.alterTable('questions', t => {
            t.string('question_type', 50).notNullable().defaultTo('single').comment('题型: single/multiple/judge/...')
        })
    }

    // questions.options (JSON)
    const hasOptions = await knex.schema.hasColumn('questions', 'options')
    if (!hasOptions) {
        // MySQL 5.7+ 支持 JSON；如不支持可改为 TEXT
        await knex.schema.alterTable('questions', t => {
            t.json('options').nullable().comment('题目选项 JSON')
        })
    }

    // 为 question_type 建索引（避免重复）
    const [idxRow] = await knex.raw(`
    SELECT COUNT(1) as c
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'questions'
      AND index_name = 'idx_questions_question_type'
  `) as any
    const existsIdx = Array.isArray(idxRow) ? idxRow[0]?.c > 0 : idxRow?.c > 0
    if (!existsIdx) {
        await knex.schema.alterTable('questions', t => {
            t.index(['question_type'], 'idx_questions_question_type')
        })
    }

    // exam_results.time_spent（提交逻辑会用到）
    const hasTimeSpent = await knex.schema.hasColumn('exam_results', 'time_spent')
    if (!hasTimeSpent) {
        await knex.schema.alterTable('exam_results', t => {
            t.integer('time_spent').unsigned().notNullable().defaultTo(0).comment('作答时长(秒)')
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    // 安全起见，down 不删除字段，只回滚索引
    // 如确需回滚，可按需加 dropColumn
    const [idxRow] = await knex.raw(`
    SELECT COUNT(1) as c
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'questions'
      AND index_name = 'idx_questions_question_type'
  `) as any
    const existsIdx = Array.isArray(idxRow) ? idxRow[0]?.c > 0 : idxRow?.c > 0
    if (existsIdx) {
        await knex.schema.alterTable('questions', t => {
            t.dropIndex(['question_type'], 'idx_questions_question_type')
        })
    }
}
