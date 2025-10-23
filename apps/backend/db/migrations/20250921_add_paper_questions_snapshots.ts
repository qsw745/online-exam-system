// 20250921_add_paper_questions_snapshots.ts
import type { Knex } from 'knex'
export const config = { transaction: false }  // ← 关键：禁用该迁移的事务

async function addColumnIfMissing(
    knex: Knex,
    tableName: string,
    col: string,
    build: (t: Knex.TableBuilder) => void
) {
    const exists = await knex.schema.hasColumn(tableName, col)
    if (!exists) {
        await knex.schema.alterTable(tableName, build)
    }
}

async function dropColumnIfExists(knex: Knex, tableName: string, col: string) {
    const exists = await knex.schema.hasColumn(tableName, col)
    if (exists) {
        await knex.schema.alterTable(tableName, t => {
            t.dropColumn(col)
        })
    }
}

export async function up(knex: Knex): Promise<void> {
    await knex.transaction(async trx => {
        // 1) 新增快照列（若不存在则添加）
        await addColumnIfMissing(trx, 'paper_questions', 'question_type', t =>
            t.string('question_type', 50).nullable().comment('快照：题型')
        )
        await addColumnIfMissing(trx, 'paper_questions', 'question_content', t =>
            // 用 LONGTEXT 存大题干
            t.text('question_content', 'longtext').nullable().comment('快照：题干')
        )
        await addColumnIfMissing(trx, 'paper_questions', 'question_options', t =>
            // 选项 JSON，用 LONGTEXT
            t.text('question_options', 'longtext').nullable().comment('快照：选项(JSON数组)')
        )
        await addColumnIfMissing(trx, 'paper_questions', 'question_answer', t =>
            t.string('question_answer', 255).nullable().comment('快照：正确答案(如 A 或 A,B)')
        )

        // 2) 回填历史数据（仅在 pq.* 为 NULL 时，用 questions 表对应字段填充）
        await trx.raw(`
      UPDATE paper_questions AS pq
      JOIN questions AS q ON q.id = pq.question_id
      SET
        pq.question_type    = COALESCE(pq.question_type,    q.question_type),
        pq.question_content = COALESCE(pq.question_content, q.content),
        pq.question_options = COALESCE(pq.question_options, q.options),
        pq.question_answer  = COALESCE(pq.question_answer,  q.correct_answer)
      WHERE
        pq.question_type IS NULL
        OR pq.question_content IS NULL
        OR pq.question_options IS NULL
        OR pq.question_answer IS NULL
    `)

        // 3) （可选）为常用查询加索引，加速按试卷读取
        const hasIdx = async (idx: string) => {
            const [rows] = await trx.raw(`SHOW INDEX FROM paper_questions WHERE Key_name = ?`, [idx])
            return (rows as any[]).length > 0
        }
        if (!(await hasIdx('idx_pq_paper_order'))) {
            await trx.schema.alterTable('paper_questions', t => {
                t.index(['paper_id', 'order'], 'idx_pq_paper_order')
            })
        }
        if (!(await hasIdx('uq_pq_paper_question'))) {
            // 唯一性（同一试卷不重复放同一题），已有重复时会失败，请视情况保留/移除
            try {
                await trx.schema.alterTable('paper_questions', t => {
                    t.unique(['paper_id', 'question_id'], 'uq_pq_paper_question')
                })
            } catch {
                /* 若已有重复数据可先清洗后再加唯一约束 */
            }
        }
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.transaction(async trx => {
        // 逆向删除列（安全判断后再删）
        await dropColumnIfExists(trx, 'paper_questions', 'question_answer')
        await dropColumnIfExists(trx, 'paper_questions', 'question_options')
        await dropColumnIfExists(trx, 'paper_questions', 'question_content')
        await dropColumnIfExists(trx, 'paper_questions', 'question_type')

        // 回滚索引
        try {
            await trx.schema.alterTable('paper_questions', t => {
                t.dropIndex(['paper_id', 'order'], 'idx_pq_paper_order')
            })
        } catch {}
        try {
            await trx.schema.alterTable('paper_questions', t => {
                t.dropUnique(['paper_id', 'question_id'], 'uq_pq_paper_question')
            })
        } catch {}
    })
}
