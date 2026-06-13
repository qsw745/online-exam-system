import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return

  const hasStatus = await knex.schema.hasColumn('users', 'status')
  if (!hasStatus) {
    const hasPassword = await knex.schema.hasColumn('users', 'password')
    const hasPasswordHash = await knex.schema.hasColumn('users', 'password_hash')

    await knex.schema.alterTable('users', t => {
      const status = t.enu('status', ['active', 'disabled']).notNullable().defaultTo('active').comment('用户状态')
      if (hasPassword) status.after('password')
      else if (hasPasswordHash) status.after('password_hash')
    })
  }

  // 兜底回填
  await knex.raw(`UPDATE users SET status='active' WHERE status IS NULL OR status=''`)

  // 辅助索引（查询禁用用户时会用到）
  try {
    await knex.schema.alterTable('users', t => {
      t.index(['status'], 'idx_users_status')
    })
  } catch {
    /* 可能已存在，忽略 */
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return
  const hasStatus = await knex.schema.hasColumn('users', 'status')
  if (hasStatus) {
    await knex.schema.alterTable('users', t => {
      // 先尝试删索引（忽略失败）
      try {
        t.dropIndex(['status'], 'idx_users_status')
      } catch {}
      t.dropColumn('status')
    })
  }
}
