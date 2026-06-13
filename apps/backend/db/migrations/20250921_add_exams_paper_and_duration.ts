// apps/backend/migrations/20250921_add_exams_paper_and_duration.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const hasPaper = await knex.schema.hasColumn('exams', 'paper_id')
    const hasDuration = await knex.schema.hasColumn('exams', 'duration')

    await knex.schema.alterTable('exams', (t) => {
        if (!hasPaper) {
            t.integer('paper_id').unsigned().nullable().comment('关联试卷ID')
            t.index(['paper_id'], 'idx_exams_paper_id')
        }
        if (!hasDuration) {
            t.integer('duration').unsigned().notNullable().defaultTo(60).comment('考试时长(分钟)')
        }
    })
}

export async function down(knex: Knex): Promise<void> {
    const hasPaper = await knex.schema.hasColumn('exams', 'paper_id')
    const hasDuration = await knex.schema.hasColumn('exams', 'duration')

    await knex.schema.alterTable('exams', (t) => {
        if (hasPaper) t.dropColumn('paper_id')
        if (hasDuration) t.dropColumn('duration')
    })
}
