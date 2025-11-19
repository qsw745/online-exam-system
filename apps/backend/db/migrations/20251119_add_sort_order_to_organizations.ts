import type { Knex } from 'knex'

const ORG_TABLE = 'organizations' // 如果你表名不是这个，改成实际表名

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(ORG_TABLE, 'sort_order')

  if (!hasColumn) {
    await knex.schema.alterTable(ORG_TABLE, table => {
      table.integer('sort_order').notNullable().defaultTo(0).comment('排序')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn(ORG_TABLE, 'sort_order')

  if (hasColumn) {
    await knex.schema.alterTable(ORG_TABLE, table => {
    
      table.dropColumn('sort_order')
    })
  }
}
