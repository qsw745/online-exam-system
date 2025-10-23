// db/migrations/20250917_fix_task_assignments_nulls.ts
import type { Knex } from 'knex'

type KeyUsage = { CONSTRAINT_NAME: string; COLUMN_NAME: string }
type ColumnInfo = { COLUMN_TYPE: string }
type StatRow = { INDEX_NAME: string }

/** 删除指定列上的外键（不依赖固定名字） */
async function dropFks(knex: Knex, table: string, cols: string[]) {
  const fkRows: KeyUsage[] = await knex<KeyUsage>('INFORMATION_SCHEMA.KEY_COLUMN_USAGE')
    .select('CONSTRAINT_NAME', 'COLUMN_NAME')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    .andWhere('TABLE_NAME', table)
    .whereIn('COLUMN_NAME', cols)
    // ✅ v3 类型没有 andWhereNotNull，用 whereNotNull
    .whereNotNull('REFERENCED_TABLE_NAME')

  const names = Array.from(new Set(fkRows.map(r => r.CONSTRAINT_NAME)))
  for (const name of names) {
    try {
      await knex.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``)
    } catch {}
  }
}

/** 读取完整 COLUMN_TYPE，如 'bigint(20) unsigned' */
async function getColumnType(knex: Knex, table: string, column: string) {
  const col: ColumnInfo | undefined = await knex<ColumnInfo>('INFORMATION_SCHEMA.COLUMNS')
    .select('COLUMN_TYPE')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    // ✅ 对象写法在 v3 的 andWhere 上类型不友好，拆成逐字段
    .andWhere('TABLE_NAME', table)
    .andWhere('COLUMN_NAME', column)
    .first()
  if (!col?.COLUMN_TYPE) throw new Error(`无法获取 ${table}.${column} 的 COLUMN_TYPE`)
  return col.COLUMN_TYPE
}

/** 确保索引存在 */
async function ensureIndex(knex: Knex, table: string, indexName: string, cols: string[]) {
  const stat: StatRow[] = await knex<StatRow>('INFORMATION_SCHEMA.STATISTICS')
    .select('INDEX_NAME')
    .whereRaw('TABLE_SCHEMA = DATABASE()')
    // ✅ 同上，逐字段 andWhere
    .andWhere('TABLE_NAME', table)
    .andWhere('INDEX_NAME', indexName)

  const exists = stat.length > 0
  if (!exists) {
    await knex.schema.alterTable(table, (t: Knex.TableBuilder) => {
      t.index(cols as any, indexName)
    })
  }
}

export async function up(knex: Knex): Promise<void> {
  const table = 'task_assignments'
  if (!(await knex.schema.hasTable(table))) return

  // 1) 清理历史 NULL
  await knex(table).whereNull('user_id').del()
  await knex(table).whereNull('task_id').del()

  // 2) 删除相关外键
  await dropFks(knex, table, ['user_id', 'task_id'])

  // 3) 将外键列类型与主表 id 完全一致 + NOT NULL
  const usersIdType = await getColumnType(knex, 'users', 'id')
  const tasksIdType = await getColumnType(knex, 'tasks', 'id')
  await knex.raw(`ALTER TABLE \`${table}\` MODIFY \`user_id\` ${usersIdType} NOT NULL`)
  await knex.raw(`ALTER TABLE \`${table}\` MODIFY \`task_id\` ${tasksIdType} NOT NULL`)

  // 4) 补充联合索引
  await ensureIndex(knex, table, 'idx_task_user', ['task_id', 'user_id'])

  // 5) 重新创建外键（显式命名）
  await knex.schema.alterTable(table, t => {
    t.foreign('task_id', 'fk_ta_task').references('id').inTable('tasks').onDelete('CASCADE')
    t.foreign('user_id', 'fk_ta_user').references('id').inTable('users').onDelete('CASCADE')
  })
}

export async function down(knex: Knex): Promise<void> {
  const table = 'task_assignments'
  if (!(await knex.schema.hasTable(table))) return
  try {
    await knex.schema.alterTable(table, t => {
      t.dropForeign(['task_id'], 'fk_ta_task')
      t.dropForeign(['user_id'], 'fk_ta_user')
      t.dropIndex(['task_id', 'user_id'], 'idx_task_user')
    })
  } catch {}
}
