// apps/backend/src/migrations/20250918_add_status_to_exams.ts
import type { Knex } from 'knex'

const TABLE = 'exams'
const COL = 'status'
const INDEX_NAME = 'idx_exams_status_created_at'

async function hasColumn(knex: Knex, table: string, column: string) {
    // knex.schema.hasColumn 在 MySQL 可用，这里再加一层兜底
    try {
        return await knex.schema.hasColumn(table, column)
    } catch {
        const res = await knex.raw<Array<{ ok: number }>>(
            `
      SELECT 1 AS ok
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
            [table, column]
        )
        // @ts-ignore - mysql2 返回 [rows, fields]
        const rows = Array.isArray(res) ? res[0] : res
        return (rows?.length ?? 0) > 0
    }
}

async function hasIndex(knex: Knex, table: string, indexName: string) {
    const res = await knex.raw<Array<{ ok: number }>>(
        `
    SELECT 1 AS ok
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    LIMIT 1
  `,
        [table, indexName]
    )
    // @ts-ignore
    const rows = Array.isArray(res) ? res[0] : res
    return (rows?.length ?? 0) > 0
}

export async function up(knex: Knex): Promise<void> {
    // 1) 添加 status 枚举列（draft/published/closed），默认 draft，NOT NULL
    if (!(await hasColumn(knex, TABLE, COL))) {
        await knex.schema.alterTable(TABLE, t => {
            // MySQL 下 enu -> ENUM
            // 这里不加注释/AFTER 位置，避免跨库差异；如需注释可再用 knex.raw 修改
            t.enu(COL, ['draft', 'published', 'closed']).notNullable().defaultTo('draft')
        })
        // 如需列注释，可解注以下语句（MySQL）：
        // await knex.raw(`ALTER TABLE \`${TABLE}\` MODIFY \`${COL}\` ENUM('draft','published','closed') NOT NULL DEFAULT 'draft' COMMENT '考试状态'`)
    }

    // 2) 创建组合索引：status + created_at（常用筛选+倒序）
    if (!(await hasIndex(knex, TABLE, INDEX_NAME))) {
        await knex.schema.alterTable(TABLE, t => {
            t.index(['status', 'created_at'], INDEX_NAME)
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    // 先删索引（若存在）
    if (await hasIndex(knex, TABLE, INDEX_NAME)) {
        await knex.schema.alterTable(TABLE, t => {
            t.dropIndex(['status', 'created_at'], INDEX_NAME)
        })
    }
    // 再删列（若存在）
    if (await hasColumn(knex, TABLE, COL)) {
        await knex.schema.alterTable(TABLE, t => {
            t.dropColumn(COL)
        })
    }
}
