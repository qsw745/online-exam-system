import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('users')
  if (!hasTable) {
    throw new Error('users table does not exist')
  }

  const hasFailed = await knex.schema.hasColumn('users', 'failed_login_attempts')
  if (!hasFailed) {
    await knex.schema.alterTable('users', (t: Knex.TableBuilder) => {
      t.integer('failed_login_attempts').unsigned().notNullable().defaultTo(0).comment('连续登录失败次数')
    })
  }

  const hasLastFailed = await knex.schema.hasColumn('users', 'last_failed_at')
  if (!hasLastFailed) {
    await knex.schema.alterTable('users', (t: Knex.TableBuilder) => {
      t.dateTime('last_failed_at').nullable().comment('最近一次登录失败时间')
    })
  }

  const hasLockedUntil = await knex.schema.hasColumn('users', 'locked_until')
  if (!hasLockedUntil) {
    await knex.schema.alterTable('users', (t: Knex.TableBuilder) => {
      t.dateTime('locked_until').nullable().comment('账户锁定截止时间')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('users')
  if (!hasTable) return

  // 为了跨方言稳定，这里逐一 drop（MySQL/PG 都可）
  const cols = ['failed_login_attempts', 'last_failed_at', 'locked_until'] as const
  for (const c of cols) {
    const hasCol = await knex.schema.hasColumn('users', c)
    if (hasCol) {
      await knex.schema.alterTable('users', (t: Knex.TableBuilder) => {
        t.dropColumn(c)
      })
    }
  }
}
