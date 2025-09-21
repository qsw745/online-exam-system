// apps/backend/migrations/20250921_add_questions_type_and_options.ts
import type { Knex } from 'knex'

// 题型枚举（与后端代码保持一致，仅作为注释说明）
const QUESTION_TYPES = ['single', 'multiple', 'true_false', 'fill_blank', 'short_answer'] as const

async function indexExists(knex: Knex, table: string, indexName: string): Promise<boolean> {
    // 用 SHOW INDEX 避免依赖 information_schema / 数据库名
    const res: any = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [table, indexName])
    // mysql2 驱动下 rows 在 res[0]
    const rows = Array.isArray(res) ? res[0] : res
    return Array.isArray(rows) && rows.length > 0
}

export async function up(knex: Knex): Promise<void> {
    const hasType = await knex.schema.hasColumn('questions', 'type')
    const hasOptions = await knex.schema.hasColumn('questions', 'options')
    const hasCorrect = await knex.schema.hasColumn('questions', 'correct_answer')

    // 先补列
    await knex.schema.alterTable('questions', (t) => {
        if (!hasType) {
            // 用 VARCHAR 而不是 ENUM，更通用
            t.string('type', 32).notNullable().defaultTo('single').comment('题型：single/multiple/true_false/fill_blank/short_answer')
        }
        if (!hasOptions) {
            // 如果你的 MySQL 是 8.0+，也可换成 t.json('options')
            t.text('options', 'longtext').nullable().comment('题目选项(JSON 字符串)')
        }
        if (!hasCorrect) {
            t.text('correct_answer', 'longtext').notNullable().defaultTo('').comment('正确答案（JSON 或字符串）')
        }
    })

    // 再安全地创建索引（如果不存在）
    const needIdx = await indexExists(knex, 'questions', 'idx_questions_type')
    if (!needIdx) {
        // 用原生 SQL 显式创建索引，等价于 t.index(['type'], 'idx_questions_type')
        await knex.raw('CREATE INDEX ?? ON ?? (`type`)', ['idx_questions_type', 'questions'])
    }
}

export async function down(knex: Knex): Promise<void> {
    // 先安全地删索引（如果存在）
    const hasIdx = await indexExists(knex, 'questions', 'idx_questions_type')
    if (hasIdx) {
        await knex.raw('ALTER TABLE ?? DROP INDEX ??', ['questions', 'idx_questions_type'])
    }

    const hasType = await knex.schema.hasColumn('questions', 'type')
    const hasOptions = await knex.schema.hasColumn('questions', 'options')
    const hasCorrect = await knex.schema.hasColumn('questions', 'correct_answer')

    await knex.schema.alterTable('questions', (t) => {
        if (hasType) t.dropColumn('type')
        if (hasOptions) t.dropColumn('options')
        if (hasCorrect) t.dropColumn('correct_answer')
    })
}
