// migrations/20251021_fix_logs_columns.ts
import type { Knex } from 'knex'

const TBL = 'logs'

export async function up(knex: Knex): Promise<void> {
  // helper：缺则加
  const addIfMissing = async (name: string, adder: (t: Knex.CreateTableBuilder | Knex.AlterTableBuilder) => void) => {
    const exists = await knex.schema.hasColumn(TBL, name)
    if (!exists) {
      await knex.schema.alterTable(TBL, t => adder(t))
    }
  }

  // —— 按 LogRepository.insert 的写入顺序把所有字段补齐 —— //

  await addIfMissing('log_type', t => t.string('log_type', 32).notNullable().defaultTo('system'))
  await addIfMissing('level', t => t.string('level', 16).notNullable().defaultTo('info'))
  await addIfMissing('user_id', t => t.bigInteger('user_id').nullable())

  await addIfMissing('action', t => t.string('action', 128).nullable())

  await addIfMissing('resource_type', t => t.string('resource_type', 64).nullable())
  await addIfMissing('resource_id', t => t.bigInteger('resource_id').nullable())

  // message/ details：用 TEXT 更通用（避免 JSON 类型在低版本 MySQL 报错）
  await addIfMissing('message', t => t.text('message').nullable())
  await addIfMissing('details', t => t.text('details', 'mediumtext').nullable())

  // UA/ IP 可能会较长，这里放大一些
  await addIfMissing('ip_address', t => t.string('ip_address', 64).nullable())
  await addIfMissing('user_agent', t => t.string('user_agent', 1024).nullable())

  await addIfMissing('status', t => t.string('status', 32).nullable())

  // 统一的时间列（默认当前时间）
  await addIfMissing('created_at', t =>
    t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
  )

  // （可选）常用索引
  // await knex.schema.alterTable(TBL, (t) => {
  //   t.index(['log_type', 'created_at'], 'idx_logs_type_created_at');
  //   t.index(['user_id', 'created_at'], 'idx_logs_user_created_at');
  // });
}

export async function down(knex: Knex): Promise<void> {
  // 回滚只删除我们在 up 里“可能新增”的列（存在才删）
  const dropIfExists = async (name: string) => {
    if (await knex.schema.hasColumn(TBL, name)) {
      await knex.schema.alterTable(TBL, t => t.dropColumn(name))
    }
  }

  // 若你不想在回滚时删掉某些列，可以注释对应行
  await dropIfExists('created_at')
  await dropIfExists('status')
  await dropIfExists('user_agent')
  await dropIfExists('ip_address')
  await dropIfExists('details')
  await dropIfExists('message')
  await dropIfExists('resource_id')
  await dropIfExists('resource_type')
  await dropIfExists('action')
  await dropIfExists('user_id')
  await dropIfExists('level')
  await dropIfExists('log_type')

  // （如果 up 里加了索引，这里记得 dropIndex）
  // await knex.schema.alterTable(TBL, (t) => {
  //   t.dropIndex(['log_type', 'created_at'], 'idx_logs_type_created_at');
  //   t.dropIndex(['user_id', 'created_at'], 'idx_logs_user_created_at');
  // });
}
