// apps/backend/db/migrations/20250918_add_difficulty_to_papers.ts
import type { Knex } from 'knex'

/** INFO_SCHEMA: 是否存在索引 */
async function indexExists(knex: Knex, table: string, index: string) {
    const [rows] = await knex.raw<Array<{ INDEX_NAME: string }>>(
        `
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
  `,
        [table, index]
    )
    return Array.isArray(rows) && rows.length > 0
}

/** 确保索引存在 */
async function ensureIndex(knex: Knex, table: string, indexName: string, cols: string[]) {
    const exists = await indexExists(knex, table, indexName)
    if (!exists) {
        await knex.schema.alterTable(table, (t) => {
            // @ts-expect-error: knex typings for index cols are loose
            t.index(cols as any, indexName)
        })
    }
}

export async function up(knex: Knex): Promise<void> {
    const table = 'papers'

    // 1) 如果没有 difficulty 字段，则新增 ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium'
    const hasDifficulty = await knex.schema.hasColumn(table, 'difficulty')
    if (!hasDifficulty) {
        // 用 knex.schema 即可在 MySQL 上生成 ENUM
        await knex.schema.alterTable(table, (t) => {
            // 注意：MySQL 的 ENUM 在 knex 里用 enu
            // 设默认值 'medium'，并 NOT NULL，历史数据将自动填充默认值
            // (不指定 .after() 以避免不同版本方言不兼容)
            t.enu('difficulty', ['easy', 'medium', 'hard']).notNullable().defaultTo('medium')
        })
    }

    // 2) 索引：若有 created_at，就建 (difficulty, created_at)；否则建 (difficulty)
    const hasCreatedAt = await knex.schema.hasColumn(table, 'created_at')
    if (hasCreatedAt) {
        await ensureIndex(knex, table, 'idx_papers_difficulty_created_at', ['difficulty', 'created_at'])
    } else {
        await ensureIndex(knex, table, 'idx_papers_difficulty', ['difficulty'])
    }
}

export async function down(knex: Knex): Promise<void> {
    const table = 'papers'

    // 1) 尝试删除可能存在的两个索引（无则忽略）
    try {
        if (await indexExists(knex, table, 'idx_papers_difficulty_created_at')) {
            // MySQL
            await knex.raw(`DROP INDEX idx_papers_difficulty_created_at ON \`${table}\``)
        }
    } catch {}
    try {
        if (await indexExists(knex, table, 'idx_papers_difficulty')) {
            await knex.raw(`DROP INDEX idx_papers_difficulty ON \`${table}\``)
        }
    } catch {}

    // 2) 删列（存在才删）
    const hasDifficulty = await knex.schema.hasColumn(table, 'difficulty')
    if (hasDifficulty) {
        await knex.schema.alterTable(table, (t) => {
            t.dropColumn('difficulty')
        })
    }
}
