// migrations/20250917_fix_task_assignments_nulls.ts
import type { Knex } from 'knex'

async function dropFks(knex: Knex, table: string, cols: string[]) {
    // 找到并删除指定列上的所有外键（不依赖固定名字）
    const fkRows = await knex.raw<
        Array<{ CONSTRAINT_NAME: string; COLUMN_NAME: string }>
    >(
        `
    SELECT CONSTRAINT_NAME, COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME IN (${cols.map(() => '?').join(',')})
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `,
        [table, ...cols]
    )

    // 去重后逐个 DROP
    const names = Array.from(
        new Set(fkRows[0].map((r: any) => r.CONSTRAINT_NAME))
    )
    for (const name of names) {
        try {
            await knex.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${name}\``)
        } catch {
            /* 忽略不存在等错误 */
        }
    }
}

async function getColumnType(knex: Knex, table: string, column: string) {
    // 读取完整 COLUMN_TYPE，比如 'bigint(20) unsigned' 或 'int(11)'
    const rows = await knex.raw<
        Array<{ COLUMN_TYPE: string }>
    >(
        `
    SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `,
        [table, column]
    )
    const row = rows[0][0]
    if (!row?.COLUMN_TYPE) {
        throw new Error(`无法获取 ${table}.${column} 的 COLUMN_TYPE`)
    }
    return row.COLUMN_TYPE as string
}

async function ensureIndex(knex: Knex, table: string, indexName: string, cols: string[]) {
    const stat = await knex.raw<
        Array<{ INDEX_NAME: string }>
    >(
        `
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
  `,
        [table, indexName]
    )
    const exists = stat[0] && stat[0].length > 0
    if (!exists) {
        await knex.schema.alterTable(table, (t) => {
            t.index(cols as any, indexName)
        })
    }
}

export async function up(knex: Knex): Promise<void> {
    const table = 'task_assignments'
    const has = await knex.schema.hasTable(table)
    if (!has) return

    // 1) 清理历史 NULL
    await knex(table).whereNull('user_id').del()
    await knex(table).whereNull('task_id').del()

    // 2) 删除相关外键（无论名字如何）
    await dropFks(knex, table, ['user_id', 'task_id'])

    // 3) 获取被引用主表 id 的真实类型，并将本表列改成完全一致 + NOT NULL
    const usersIdType = await getColumnType(knex, 'users', 'id')      // 例如 'bigint(20) unsigned'
    const tasksIdType = await getColumnType(knex, 'tasks', 'id')

    // 修改列类型以与引用方一致；注意使用 RAW 保留 unsigned/长度等细节
    await knex.raw(`ALTER TABLE \`${table}\` MODIFY \`user_id\` ${usersIdType} NOT NULL`)
    await knex.raw(`ALTER TABLE \`${table}\` MODIFY \`task_id\` ${tasksIdType} NOT NULL`)

    // 4) 补充联合索引
    await ensureIndex(knex, table, 'idx_task_user', ['task_id', 'user_id'])

    // 5) 重新创建外键（显式命名）
    await knex.schema.alterTable(table, (t) => {
        t
            .foreign('task_id', 'fk_ta_task')
            .references('id')
            .inTable('tasks')
            .onDelete('CASCADE')
        t
            .foreign('user_id', 'fk_ta_user')
            .references('id')
            .inTable('users')
            .onDelete('CASCADE')
    })
}

export async function down(knex: Knex): Promise<void> {
    const table = 'task_assignments'
    const has = await knex.schema.hasTable(table)
    if (!has) return

    // 尝试删我们命名的外键与索引；忽略异常
    try {
        await knex.schema.alterTable(table, (t) => {
            t.dropForeign(['task_id'], 'fk_ta_task')
            t.dropForeign(['user_id'], 'fk_ta_user')
            t.dropIndex(['task_id', 'user_id'], 'idx_task_user')
        })
    } catch {}
    // 不强制把列类型改回，避免再次引入不一致
}
