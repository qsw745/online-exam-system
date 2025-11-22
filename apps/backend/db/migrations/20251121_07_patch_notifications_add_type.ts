import type { Knex } from 'knex'

const TABLE = 'notifications'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  const hasType = await knex.schema.hasColumn(TABLE, 'type')
  if (!hasType) {
    await knex.schema.alterTable(TABLE, table => {
      table.string('type', 50).notNullable().defaultTo('info').comment('通知类型')
    })
    await knex(TABLE).update({ type: 'info' }).whereNull('type')
  }

  const hasUpdatedAt = await knex.schema.hasColumn(TABLE, 'updated_at')
  if (!hasUpdatedAt) {
    await knex.schema.alterTable(TABLE, table => {
      table
        .timestamp('updated_at')
        .notNullable()
        .defaultTo(knex.fn.now())
        .comment('最后更新时间')
    })
    await knex.raw(
      `ALTER TABLE ${TABLE}
       MODIFY COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
    )
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  if (await knex.schema.hasColumn(TABLE, 'type')) {
    await knex.schema.alterTable(TABLE, table => {
      table.dropColumn('type')
    })
  }
  if (await knex.schema.hasColumn(TABLE, 'updated_at')) {
    await knex.schema.alterTable(TABLE, table => {
      table.dropColumn('updated_at')
    })
  }
}
