import type { Knex } from 'knex'

const TABLE = 'task_assignments'
const COL_ASSIGNED_BY = 'assigned_by'
const IDX_ASSIGNED_BY = 'idx_task_assignments_assigned_by'

async function hasColumn(knex: Knex, table: string, column: string) {
  return knex.schema.hasColumn(table, column)
}

async function hasIndex(knex: Knex, table: string, index: string) {
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
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  if (!(await hasColumn(knex, TABLE, COL_ASSIGNED_BY))) {
    await knex.schema.alterTable(TABLE, table => {
      table.integer(COL_ASSIGNED_BY).unsigned().nullable().comment('分配人用户ID')
    })
  }

  if (!(await hasIndex(knex, TABLE, IDX_ASSIGNED_BY))) {
    await knex.raw(`CREATE INDEX \`${IDX_ASSIGNED_BY}\` ON \`${TABLE}\` (\`${COL_ASSIGNED_BY}\`)`)
  }

  if (await hasColumn(knex, TABLE, 'assigned_at')) {
    await knex.raw(
      `ALTER TABLE \`${TABLE}\`
         MODIFY COLUMN \`assigned_at\`
         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间'`
    )
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  if (await hasIndex(knex, TABLE, IDX_ASSIGNED_BY)) {
    await knex.raw(`DROP INDEX \`${IDX_ASSIGNED_BY}\` ON \`${TABLE}\``)
  }

  if (await hasColumn(knex, TABLE, COL_ASSIGNED_BY)) {
    await knex.schema.alterTable(TABLE, table => {
      table.dropColumn(COL_ASSIGNED_BY)
    })
  }
}
