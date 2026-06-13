// apps/backend/migrations/202509221130_add_subject_to_answer_records.ts
import type { Knex } from 'knex'

const TABLE = 'answer_records'
const COL   = 'subject'
const IDX   = 'idx_answer_records_subject'

export async function up(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable(TABLE)
    if (!hasTable) throw new Error(`Table "${TABLE}" not found`)

    const hasCol = await knex.schema.hasColumn(TABLE, COL)
    if (!hasCol) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.string(COL, 100).nullable().comment('学科/科目')
        })
    }

    const [idxRows] = await knex.raw<any[]>(`SHOW INDEX FROM \`${TABLE}\` WHERE Key_name = ?`, [IDX])
    if (!idxRows || idxRows.length === 0) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.index([COL], IDX)
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    const [idxRows] = await knex.raw<any[]>(`SHOW INDEX FROM \`${TABLE}\` WHERE Key_name = ?`, [IDX])
    if (idxRows && idxRows.length > 0) {
        await knex.raw(`DROP INDEX \`${IDX}\` ON \`${TABLE}\``)
    }

    const hasCol = await knex.schema.hasColumn(TABLE, COL)
    if (hasCol) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.dropColumn(COL)
        })
    }
}
