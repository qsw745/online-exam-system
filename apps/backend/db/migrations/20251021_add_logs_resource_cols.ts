import type { Knex } from 'knex'

const TBL = 'logs'

export async function up(knex: Knex): Promise<void> {
  // resource_type
  if (!(await knex.schema.hasColumn(TBL, 'resource_type'))) {
    await knex.schema.alterTable(TBL, t => {
      t.string('resource_type', 64).nullable()
    })
  }

  // resource_id
  if (!(await knex.schema.hasColumn(TBL, 'resource_id'))) {
    await knex.schema.alterTable(TBL, t => {
      t.bigInteger('resource_id').nullable()
    })
  }

  // created_at（没有的话才加，并设置默认 CURRENT_TIMESTAMP）
  if (!(await knex.schema.hasColumn(TBL, 'created_at'))) {
    await knex.schema.alterTable(TBL, t => {
      // MySQL: useTz: false；默认值用 knex.fn.now()
      t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    })
  }

  //（可选）给常用查询加索引 —— 需要就开启
  // const hasIdx = await knex.schema.hasColumn(TBL, 'created_at'); // 只是例子，Knex没直接 hasIndex
  // await knex.schema.alterTable(TBL, (t) => {
  //   t.index(['log_type', 'created_at'], 'idx_logs_type_created_at');
  //   t.index(['user_id', 'created_at'], 'idx_logs_user_created_at');
  // });
}

export async function down(knex: Knex): Promise<void> {
  // 只在存在时删除，避免回滚报错
  if (await knex.schema.hasColumn(TBL, 'resource_type')) {
    await knex.schema.alterTable(TBL, t => {
      t.dropColumn('resource_type')
    })
  }

  if (await knex.schema.hasColumn(TBL, 'resource_id')) {
    await knex.schema.alterTable(TBL, t => {
      t.dropColumn('resource_id')
    })
  }

  // ⚠️ 小心：回滚时删除 created_at 可能影响依赖它的查询
  if (await knex.schema.hasColumn(TBL, 'created_at')) {
    await knex.schema.alterTable(TBL, t => {
      t.dropColumn('created_at')
    })
  }

  //（如果你在 up 里加了索引，这里记得 dropIndex）
  // await knex.schema.alterTable(TBL, (t) => {
  //   t.dropIndex(['log_type', 'created_at'], 'idx_logs_type_created_at');
  //   t.dropIndex(['user_id', 'created_at'], 'idx_logs_user_created_at');
  // });
}
