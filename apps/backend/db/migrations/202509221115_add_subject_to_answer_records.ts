// apps/backend/migrations/202509221115_add_subject_to_answer_records.ts
import type { Knex } from 'knex'
export async function up(knex: Knex): Promise<void> {
    const has = await knex.schema.hasColumn('answer_records', 'subject')
    if (!has) {
        await knex.schema.alterTable('answer_records', (t) => {
            t.string('subject', 100).nullable().comment('学科/科目')
        })
    }
}
export async function down(knex: Knex): Promise<void> {
    const has = await knex.schema.hasColumn('answer_records', 'subject')
    if (has) {
        await knex.schema.alterTable('answer_records', (t) => {
            t.dropColumn('subject')
        })
    }
}
