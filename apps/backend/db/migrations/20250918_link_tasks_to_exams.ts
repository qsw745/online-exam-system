import type { Knex } from 'knex'

const TABLE = 'tasks'
const COL = 'exam_id'

async function hasColumn(knex: Knex, table: string, column: string) {
    try {
        return await knex.schema.hasColumn(table, column)
    } catch {
        const res = await knex.raw(
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
        // @ts-ignore
        const rows = Array.isArray(res) ? res[0] : res
        return (rows?.length ?? 0) > 0
    }
}

export async function up(knex: Knex): Promise<void> {
    const has = await knex.schema.hasTable(TABLE)
    if (!has) return

    if (!(await hasColumn(knex, TABLE, COL))) {
        await knex.schema.alterTable(TABLE, t => {
            t.bigint(COL).unsigned().nullable().index()
        })
    }

    // 清理不合法值（如果历史脏数据）
    await knex(TABLE).whereNotNull(COL).andWhereRaw(`NOT EXISTS(SELECT 1 FROM exams e WHERE e.id = ${TABLE}.${COL})`).update({ [COL]: null })

    // 外键（若已存在则忽略异常）
    try {
        await knex.schema.alterTable(TABLE, t => {
            t.foreign(COL, 'fk_tasks_exam').references('id').inTable('exams').onDelete('SET NULL')
        })
    } catch {}
}

export async function down(knex: Knex): Promise<void> {
    const has = await knex.schema.hasTable(TABLE)
    if (!has) return
    try {
        await knex.schema.alterTable(TABLE, t => {
            t.dropForeign([COL], 'fk_tasks_exam')
        })
    } catch {}
    try {
        await knex.schema.alterTable(TABLE, t => {
            t.dropColumn(COL)
        })
    } catch {}
}
