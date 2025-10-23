import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return

  const hasHash = await knex.schema.hasColumn('users', 'password_hash')
  const hasPwd = await knex.schema.hasColumn('users', 'password')

  // 1) 没有 password 列则先加（先 nullable，迁移完再考虑是否加 NOT NULL 约束）
  if (!hasPwd) {
    await knex.schema.alterTable('users', t => {
      t.string('password', 255).nullable().comment('bcrypt hash')
    })
  }

  // 2) 回填数据
  if (hasHash) {
    // 用 password_hash 回填到 password（仅在 password 为空时）
    await knex.raw(`
      UPDATE users
      SET password = COALESCE(password, password_hash)
      WHERE password IS NULL
    `)

    // 3) 删掉旧列
    await knex.schema.alterTable('users', t => {
      t.dropColumn('password_hash')
    })
  }

  // 这里我们保持 password 可为空，避免老数据导致迁移失败。
  // 如果你想强制 NOT NULL，可在确认所有行都有值后再加：
  // await knex.raw('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL')
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return

  const hasHash = await knex.schema.hasColumn('users', 'password_hash')
  const hasPwd = await knex.schema.hasColumn('users', 'password')

  // 回滚时复原 password_hash
  if (!hasHash) {
    await knex.schema.alterTable('users', t => {
      t.string('password_hash', 255).nullable().comment('bcrypt hash (legacy)')
    })
  }

  if (hasPwd) {
    await knex.raw(`
      UPDATE users
      SET password_hash = COALESCE(password_hash, password)
      WHERE password_hash IS NULL
    `)

    // 保留 password 也无妨；如果你想完全回到旧结构，可删除：
    // await knex.schema.alterTable('users', (t) => t.dropColumn('password'))
  }
}
