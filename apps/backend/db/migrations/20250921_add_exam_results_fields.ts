// apps/backend/migrations/20250921_add_exam_results_fields.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const table = 'exam_results'
    const hasStatus = await knex.schema.hasColumn(table, 'status')
    const hasStart = await knex.schema.hasColumn(table, 'start_time')
    const hasSubmit = await knex.schema.hasColumn(table, 'submit_time')
    const hasScore = await knex.schema.hasColumn(table, 'score')
    const hasAnswers = await knex.schema.hasColumn(table, 'answers')
    const hasTime = await knex.schema.hasColumn(table, 'time_spent')

    await knex.schema.alterTable(table, (t) => {
        if (!hasStatus) {
            t.string('status', 32).notNullable().defaultTo('in_progress').comment('in_progress/submitted')
            t.index(['status'], 'idx_exam_results_status')
        }
        if (!hasStart) t.dateTime('start_time').nullable().comment('开始作答时间')
        if (!hasSubmit) t.dateTime('submit_time').nullable().comment('提交时间')
        if (!hasScore) t.decimal('score', 10, 2).notNullable().defaultTo(0).comment('得分')
        if (!hasAnswers) t.text('answers', 'longtext').nullable().comment('用户答案(JSON)')
        if (!hasTime) t.integer('time_spent').unsigned().notNullable().defaultTo(0).comment('作答时长(秒)')
    })
}

export async function down(knex: Knex): Promise<void> {
    const table = 'exam_results'
    const hasStatus = await knex.schema.hasColumn(table, 'status')
    const hasStart = await knex.schema.hasColumn(table, 'start_time')
    const hasSubmit = await knex.schema.hasColumn(table, 'submit_time')
    const hasScore = await knex.schema.hasColumn(table, 'score')
    const hasAnswers = await knex.schema.hasColumn(table, 'answers')
    const hasTime = await knex.schema.hasColumn(table, 'time_spent')

    await knex.schema.alterTable(table, (t) => {
        if (hasStatus) t.dropColumn('status')
        if (hasStart) t.dropColumn('start_time')
        if (hasSubmit) t.dropColumn('submit_time')
        if (hasScore) t.dropColumn('score')
        if (hasAnswers) t.dropColumn('answers')
        if (hasTime) t.dropColumn('time_spent')
    })
}
