import type { Knex } from 'knex'

const TABLES = [
  { name: 'notifications', defaultSource: 'system' },
  { name: 'messages', defaultSource: 'message' },
  { name: 'todos', defaultSource: 'todo' },
]

async function ensureColumn(
  knex: Knex,
  tableName: string,
  columnName: string,
  builder: (table: Knex.AlterTableBuilder) => void
) {
  const hasColumn = await knex.schema.hasColumn(tableName, columnName)
  if (!hasColumn) {
    await knex.schema.alterTable(tableName, builder)
  }
}

export async function up(knex: Knex): Promise<void> {
  for (const { name, defaultSource } of TABLES) {
    await ensureColumn(knex, name, 'source', table => {
      table.string('source', 64).notNullable().defaultTo(defaultSource).comment('来源模块/业务')
    })
    await ensureColumn(knex, name, 'target_path', table => {
      table.string('target_path', 255).nullable().comment('对应前端跳转路径')
    })
    await ensureColumn(knex, name, 'metadata', table => {
      table.json('metadata').nullable().comment('附加 JSON 数据')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const { name } of TABLES) {
    if (await knex.schema.hasColumn(name, 'metadata')) {
      await knex.schema.alterTable(name, table => table.dropColumn('metadata'))
    }
    if (await knex.schema.hasColumn(name, 'target_path')) {
      await knex.schema.alterTable(name, table => table.dropColumn('target_path'))
    }
    if (await knex.schema.hasColumn(name, 'source')) {
      await knex.schema.alterTable(name, table => table.dropColumn('source'))
    }
  }
}
