import type { Knex } from 'knex'

/**
 * 这个迁移会：
 * 1) 新增 users.nickname VARCHAR(64) NULL COMMENT '显示用昵称，可中文'
 * 2) 确保 email / username 唯一索引分别为 uk_users_email / uk_users_username
 * 3) 尝试移除可能存在的旧索引名（users_email_unique / users_username_unique）
 * 4) 建议性转换 users 表字符集为 utf8mb4（忽略失败）
 */

export async function up(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return

  // 1) 新增 nickname 列（若不存在）
  const hasNickname = await knex.schema.hasColumn('users', 'nickname')
  if (!hasNickname) {
    await knex.schema.alterTable('users', t => {
      // MySQL 方言下 comment 会生效；其他方言则忽略
      t.string('nickname', 64).nullable().comment('显示用昵称，可中文').after?.('username')
    })
  }

  // 2) 处理唯一索引（注意：MySQL 不支持 IF NOT EXISTS，这里用 try/catch 规避重复报错）
  // 2.1 清理旧索引名，忽略失败
  try {
    await knex.raw(`ALTER TABLE users DROP INDEX users_email_unique`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE users DROP INDEX users_username_unique`)
  } catch {}

  // 2.2 创建新索引（若已存在会抛错，忽略即可）
  try {
    await knex.raw(`ALTER TABLE users ADD UNIQUE INDEX uk_users_email (email)`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE users ADD UNIQUE INDEX uk_users_username (username)`)
  } catch {}

  // 3) 建议性：将表字符集改为 utf8mb4，避免昵称中文/emoji 乱码（忽略失败）
  try {
    await knex.raw(`ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
  } catch {}
}

export async function down(knex: Knex): Promise<void> {
  const hasUsers = await knex.schema.hasTable('users')
  if (!hasUsers) return

  // 回滚唯一索引（忽略失败）
  try {
    await knex.raw(`ALTER TABLE users DROP INDEX uk_users_email`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE users DROP INDEX uk_users_username`)
  } catch {}

  // 回滚 nickname 列（若存在）
  const hasNickname = await knex.schema.hasColumn('users', 'nickname')
  if (hasNickname) {
    await knex.schema.alterTable('users', t => {
      t.dropColumn('nickname')
    })
  }
}
