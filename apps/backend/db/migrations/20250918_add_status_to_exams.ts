// apps/backend/db/migrations/20250918_add_status_to_exams.ts
import type { Knex } from 'knex'

const TABLE = 'exams'
const COL = 'status'
const INDEX_NAME = 'idx_exams_status_created_at'

type ColRow = { COLUMN_NAME: string }
type StatRow = { INDEX_NAME: string }

async function hasColumn(knex: Knex, table: string, column: string): Promise<boolean> {
  // 先走官方 API；个别方言异常时降级信息_schema
  try {
    return await knex.schema.hasColumn(table, column)
  } catch {
    const row = await knex<ColRow>('INFORMATION_SCHEMA.COLUMNS')
      .select('COLUMN_NAME')
      .whereRaw('TABLE_SCHEMA = DATABASE()')
      .andWhere('TABLE_NAME', table)
      .andWhere('COLUMN_NAME', column)
      .first()
    return !!row
  }
}

async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const row = await knex<StatRow>('INFORMATION_SCHEMA.STATISTICS')
    .select('INDEX_NAME')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    .andWhere('TABLE_NAME', table)
    .andWhere('INDEX_NAME', indexName)
    .first()
  return !!row
}

export async function up(knex: Knex): Promise<void> {
  // 1) 添加 status 枚举列（draft/published/closed），默认 draft，NOT NULL
  if (!(await hasColumn(knex, TABLE, COL))) {
    await knex.schema.alterTable(TABLE, (t: Knex.TableBuilder) => {
      t.enu(COL, ['draft', 'published', 'closed']).notNullable().defaultTo('draft').comment('考试状态')
    })
  }

  // 2) 组合索引：status + created_at
  if (!(await hasIndex(knex, TABLE, INDEX_NAME))) {
    await knex.schema.alterTable(TABLE, (t: Knex.TableBuilder) => {
      const cols: ReadonlyArray<string> = ['status', 'created_at']
      t.index(cols, INDEX_NAME)
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  // 先删索引
  if (await hasIndex(knex, TABLE, INDEX_NAME)) {
    await knex.schema.alterTable(TABLE, (t: Knex.TableBuilder) => {
      t.dropIndex(['status', 'created_at'], INDEX_NAME)
    })
  }
  // 再删列
  if (await hasColumn(knex, TABLE, COL)) {
    await knex.schema.alterTable(TABLE, (t: Knex.TableBuilder) => {
      t.dropColumn(COL)
    })
  }
}
