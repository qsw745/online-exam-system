import type { Knex } from 'knex'

const TABLE = 'discussions'

async function addColumnIfMissing(knex: Knex, column: string, builder: (t: Knex.AlterTableBuilder) => void) {
  const has = await knex.schema.hasColumn(TABLE, column)
  if (!has) {
    await knex.schema.alterTable(TABLE, builder)
  }
}

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  const addedTags = !(await knex.schema.hasColumn(TABLE, 'tags'))
  await addColumnIfMissing(knex, 'tags', t => t.json('tags').nullable().comment('标签 JSON'))
  if (addedTags) {
    await knex(TABLE).update('tags', '[]')
  }
  await addColumnIfMissing(knex, 'related_type', t =>
    t.string('related_type', 50).notNullable().defaultTo('general').comment('关联资源类型')
  )
  await addColumnIfMissing(knex, 'related_id', t =>
    t.bigInteger('related_id').unsigned().nullable().comment('关联资源 ID')
  )
  await addColumnIfMissing(knex, 'is_locked', t => t.boolean('is_locked').notNullable().defaultTo(false))
  await addColumnIfMissing(knex, 'is_featured', t => t.boolean('is_featured').notNullable().defaultTo(false))
  await addColumnIfMissing(knex, 'like_count', t => t.integer('like_count').notNullable().defaultTo(0))
  await addColumnIfMissing(knex, 'last_reply_user_id', t =>
    t.bigInteger('last_reply_user_id').unsigned().nullable().comment('最后回复用户')
  )

  // 视具体业务是否需要索引
  const hasColumnsForIndex = await knex.schema.hasColumn(TABLE, 'related_type')
  if (hasColumnsForIndex) {
    const [indexes] = await knex.raw(`SHOW INDEX FROM ${TABLE} WHERE Key_name = 'idx_discuss_related'`)
    if (!indexes?.length) {
      await knex.schema.alterTable(TABLE, table => {
        table.index(['related_type', 'related_id'], 'idx_discuss_related')
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  const drop = async (column: string, handler?: (t: Knex.AlterTableBuilder) => void) => {
    if (await knex.schema.hasColumn(TABLE, column)) {
      await knex.schema.alterTable(TABLE, handler ?? (t => t.dropColumn(column)))
    }
  }

  await drop('last_reply_user_id')
  await drop('like_count')
  await drop('is_featured')
  await drop('is_locked')
  await drop('related_id')
  if (await knex.schema.hasColumn(TABLE, 'related_type')) {
    const [indexes] = await knex.raw(`SHOW INDEX FROM ${TABLE} WHERE Key_name = 'idx_discuss_related'`)
    if (indexes?.length) {
      await knex.schema.alterTable(TABLE, table => {
        table.dropIndex(['related_type', 'related_id'], 'idx_discuss_related')
      })
    }
    await knex.schema.alterTable(TABLE, table => table.dropColumn('related_type'))
  }
  await drop('tags')
}
