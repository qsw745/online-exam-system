import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    // exams.subject_name
    if (await knex.schema.hasTable('exams')) {
        const has = await knex.schema.hasColumn('exams', 'subject_name')
        if (!has) {
            await knex.schema.alterTable('exams', t => {
                t.string('subject_name', 64).nullable().comment('学科名称（可选）')
            })
        }
        // exams.paper_id 索引（若无）
        try { await knex.raw('CREATE INDEX idx_exams_paper_id ON exams (paper_id)') } catch {}
    }

    // papers.total_questions
    if (await knex.schema.hasTable('papers')) {
        const has = await knex.schema.hasColumn('papers', 'total_questions')
        if (!has) {
            await knex.schema.alterTable('papers', t => {
                t.integer('total_questions').unsigned().nullable().comment('试卷题目总数（可选）')
            })
        }
    }

    // exam_results 索引：submit_time、(user_id, submit_time)
    if (await knex.schema.hasTable('exam_results')) {
        if (await knex.schema.hasColumn('exam_results', 'submit_time')) {
            try { await knex.raw('CREATE INDEX idx_er_submit_time ON exam_results (submit_time)') } catch {}
            try { await knex.raw('CREATE INDEX idx_er_user_submit ON exam_results (user_id, submit_time)') } catch {}
        }
    }
}

export async function down(knex: Knex): Promise<void> {
    if (await knex.schema.hasTable('exams')) {
        if (await knex.schema.hasColumn('exams', 'subject_name')) {
            await knex.schema.alterTable('exams', t => t.dropColumn('subject_name'))
        }
        try { await knex.raw('DROP INDEX idx_exams_paper_id ON exams') } catch {}
    }
    if (await knex.schema.hasTable('papers')) {
        if (await knex.schema.hasColumn('papers', 'total_questions')) {
            await knex.schema.alterTable('papers', t => t.dropColumn('total_questions'))
        }
    }
    if (await knex.schema.hasTable('exam_results')) {
        try { await knex.raw('DROP INDEX idx_er_submit_time ON exam_results') } catch {}
        try { await knex.raw('DROP INDEX idx_er_user_submit ON exam_results') } catch {}
    }
}
