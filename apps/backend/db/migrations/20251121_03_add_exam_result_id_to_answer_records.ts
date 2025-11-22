import type { Knex } from 'knex'

const TABLE = 'answer_records'
const COLUMN = 'exam_result_id'
const IDX = 'idx_answer_records_exam_result'

async function hasColumn(knex: Knex, table: string, column: string): Promise<boolean> {
  return knex.schema.hasColumn(table, column)
}

async function hasIndex(knex: Knex, table: string, index: string): Promise<boolean> {
  const [rows] = await knex.raw(
    `SELECT 1
       FROM information_schema.statistics
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1`,
    [table, index]
  )
  return Array.isArray(rows) && rows.length > 0
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return

  if (!(await hasColumn(knex, TABLE, COLUMN))) {
    await knex.schema.alterTable(TABLE, table => {
      table.integer(COLUMN).unsigned().nullable().index().comment('关联 exam_results.id')
    })

    // 尝试用 exam_id + user_id 回填历史数据
    try {
      await knex.raw(`
        UPDATE answer_records ar
        JOIN exam_results er
          ON er.exam_id = ar.exam_id
         AND er.user_id = ar.user_id
        SET ar.exam_result_id = er.id
        WHERE ar.exam_result_id IS NULL
      `)
    } catch {}
  }

  if (!(await hasIndex(knex, TABLE, IDX))) {
    await knex.raw(`CREATE INDEX \`${IDX}\` ON \`${TABLE}\` (\`${COLUMN}\`)`)
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return

  if (await hasIndex(knex, TABLE, IDX)) {
    await knex.raw(`DROP INDEX \`${IDX}\` ON \`${TABLE}\``)
  }

  if (await hasColumn(knex, TABLE, COLUMN)) {
    await knex.schema.alterTable(TABLE, table => {
      table.dropColumn(COLUMN)
    })
  }
}
