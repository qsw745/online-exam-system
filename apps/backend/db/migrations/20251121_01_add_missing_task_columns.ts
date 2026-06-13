import type { Knex } from 'knex'

const TABLE = 'tasks'
const IDX_USER = 'idx_tasks_user_id'

async function ensureColumn(knex: Knex, column: string, cb: (table: Knex.TableBuilder) => void) {
  const hasColumn = await knex.schema.hasColumn(TABLE, column)
  if (hasColumn) return
  await knex.schema.alterTable(TABLE, table => {
    cb(table)
  })
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

async function dropIndex(knex: Knex, table: string, index: string): Promise<void> {
  if (!(await hasIndex(knex, table, index))) return
  await knex.raw(`DROP INDEX \`${index}\` ON \`${table}\``)
}

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  await ensureColumn(knex, 'user_id', table => {
    table.integer('user_id').unsigned().nullable().comment('创建人')
  })

  await ensureColumn(knex, 'type', table => {
    table
      .enum('type', ['exam', 'practice'])
      .notNullable()
      .defaultTo('practice')
      .comment('任务类型')
  })

  await ensureColumn(knex, 'start_time', table => {
    table.dateTime('start_time').nullable().comment('任务开始时间')
  })

  await ensureColumn(knex, 'end_time', table => {
    table.dateTime('end_time').nullable().comment('任务结束时间')
  })

  await ensureColumn(knex, 'updated_at', table => {
    table
      .timestamp('updated_at', { useTz: false })
      .notNullable()
      .defaultTo(knex.fn.now())
      .comment('更新时间')
  })

  // 扩充状态枚举，允许服务端使用的所有状态值（兼容历史值）
  if (await knex.schema.hasColumn(TABLE, 'status')) {
    await knex.raw(
      `ALTER TABLE \`${TABLE}\`
         MODIFY COLUMN \`status\`
         ENUM('not_started','in_progress','completed','expired','published','unpublished','draft','pending','todo','doing','done')
         NOT NULL DEFAULT 'not_started' COMMENT '任务状态'`
    )
  }

  // 列类型/默认值对齐
  if (await knex.schema.hasColumn(TABLE, 'type')) {
    await knex.raw(
      `ALTER TABLE \`${TABLE}\`
         MODIFY COLUMN \`type\` ENUM('exam','practice') NOT NULL DEFAULT 'practice' COMMENT '任务类型'`
    )
  }
  if (await knex.schema.hasColumn(TABLE, 'start_time')) {
    await knex.raw(
      `ALTER TABLE \`${TABLE}\`
         MODIFY COLUMN \`start_time\` DATETIME NULL COMMENT '任务开始时间'`
    )
  }
  if (await knex.schema.hasColumn(TABLE, 'end_time')) {
    await knex.raw(
      `ALTER TABLE \`${TABLE}\`
         MODIFY COLUMN \`end_time\` DATETIME NULL COMMENT '任务结束时间'`
    )
  }
  if (await knex.schema.hasColumn(TABLE, 'updated_at')) {
    await knex.raw(
      `ALTER TABLE \`${TABLE}\`
         MODIFY COLUMN \`updated_at\`
         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'`
    )
  }

  if (!(await hasIndex(knex, TABLE, IDX_USER))) {
    await knex.raw(`CREATE INDEX \`${IDX_USER}\` ON \`${TABLE}\` (\`user_id\`)`)
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE)
  if (!hasTable) return

  await dropIndex(knex, TABLE, IDX_USER)

  const dropColumn = async (column: string) => {
    if (!(await knex.schema.hasColumn(TABLE, column))) return
    await knex.schema.alterTable(TABLE, table => {
      table.dropColumn(column)
    })
  }

  await dropColumn('user_id')
  await dropColumn('type')
  await dropColumn('start_time')
  await dropColumn('end_time')
  await dropColumn('updated_at')

  if (await knex.schema.hasColumn(TABLE, 'status')) {
    // 回退到最初的最小枚举，若之前不存在则忽略错误
    try {
      await knex.raw(
        `ALTER TABLE \`${TABLE}\`
           MODIFY COLUMN \`status\`
           ENUM('pending','in_progress','completed')
           NOT NULL DEFAULT 'pending' COMMENT '任务状态'`
      )
    } catch {}
  }
}
