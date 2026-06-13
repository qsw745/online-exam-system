// apps/backend/migrations/20250921_add_paper_questions_order_and_score.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const hasOrder = await knex.schema.hasColumn('paper_questions', 'order')
    const hasScore = await knex.schema.hasColumn('paper_questions', 'score')

    await knex.schema.alterTable('paper_questions', (t) => {
        if (!hasOrder) {
            t.integer('order').unsigned().notNullable().defaultTo(1).comment('题目在试卷中的顺序(从1开始)')
            t.index(['paper_id', 'order'], 'idx_paper_questions_order')
        }
        if (!hasScore) {
            t.integer('score').unsigned().notNullable().defaultTo(1).comment('该题分值')
        }
    })

    // 可选：唯一约束，避免同一题重复加入同一试卷（如果你没有这个约束）
    const hasUnique = await knex.schema.hasColumn('paper_questions', 'question_id') // 仅确认表在
    if (hasUnique) {
        try {
            await knex.raw('ALTER TABLE `paper_questions` ADD UNIQUE KEY `uniq_paper_question` (`paper_id`,`question_id`)')
        } catch {
            // 已存在就忽略
        }
    }
}

export async function down(knex: Knex): Promise<void> {
    const hasOrder = await knex.schema.hasColumn('paper_questions', 'order')
    const hasScore = await knex.schema.hasColumn('paper_questions', 'score')

    // 先尝试移除唯一键（如果加过）
    try {
        await knex.raw('ALTER TABLE `paper_questions` DROP INDEX `uniq_paper_question`')
    } catch {}

    await knex.schema.alterTable('paper_questions', (t) => {
        if (hasOrder) t.dropColumn('order')
        if (hasScore) t.dropColumn('score')
    })
}
