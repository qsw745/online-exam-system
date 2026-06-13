import type { Knex } from 'knex'

/**
 * 幂等迁移：
 * - 添加 users.nickname 字段（如不存在）
 * - 统一 email/username 唯一索引名：uk_users_email / uk_users_username
 * - 清理可能遗留的旧索引名：users_email_unique / users_username_unique
 * - 可选：表字符集转为 utf8mb4（忽略失败）
 */

async function tableExists(knex: Knex, table: string): Promise<boolean> {
  return knex.schema.hasTable(table)
}

async function columnExists(knex: Knex, table: string, column: string): Promise<boolean> {
  try {
    const [rows] = await knex.raw<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column])
    return Array.isArray(rows) ? rows.length > 0 : (rows as any)?.length > 0
  } catch {
    return false
  }
}

async function indexExists(knex: Knex, table: string, indexName: string): Promise<boolean> {
  try {
    const [rows] = await knex.raw<any[]>(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
    return Array.isArray(rows) ? rows.length > 0 : (rows as any)?.length > 0
  } catch {
    return false
  }
}

export async function up(knex: Knex): Promise<void> {
  const tbl = 'users'
  if (!(await tableExists(knex, tbl))) return

  // 1) nickname 列（优先使用 IF NOT EXISTS；如不支持则用存在性检测兜底）
  const hasNickname = await columnExists(knex, tbl, 'nickname')
  if (!hasNickname) {
    try {
      // MySQL 8+ 支持 IF NOT EXISTS；MariaDB 也支持
      await knex.raw(
        `ALTER TABLE \`${tbl}\` ADD COLUMN IF NOT EXISTS \`nickname\` varchar(64) NULL COMMENT '显示用昵称，可中文' AFTER \`username\``
      )
    } catch {
      // 部分老版本不支持 IF NOT EXISTS，则再做一次 exists 检测后直接 ADD
      const stillNoNickname = !(await columnExists(knex, tbl, 'nickname'))
      if (stillNoNickname) {
        await knex.schema.alterTable(tbl, t => {
          // @ts-ignore: MySQL 方言支持 after()
          t.string('nickname', 64).nullable().comment('显示用昵称，可中文').after?.('username')
        })
      }
    }
  }

  // 2) 清理旧索引名（忽略失败）
  if (await indexExists(knex, tbl, 'users_email_unique')) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP INDEX \`users_email_unique\``)
    } catch {}
  }
  if (await indexExists(knex, tbl, 'users_username_unique')) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP INDEX \`users_username_unique\``)
    } catch {}
  }

  // 3) 创建统一的新唯一索引（若不存在）
  if (!(await indexExists(knex, tbl, 'uk_users_email'))) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` ADD UNIQUE INDEX \`uk_users_email\` (\`email\`)`)
    } catch {}
  }
  if (!(await indexExists(knex, tbl, 'uk_users_username'))) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` ADD UNIQUE INDEX \`uk_users_username\` (\`username\`)`)
    } catch {}
  }

  // 4) 建议：转表字符集为 utf8mb4（避免昵称中中文/emoji 乱码），失败忽略
  try {
    await knex.raw(`ALTER TABLE \`${tbl}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
  } catch {}
}

export async function down(knex: Knex): Promise<void> {
  const tbl = 'users'
  if (!(await tableExists(knex, tbl))) return

  // 回滚索引（若存在）
  if (await indexExists(knex, tbl, 'uk_users_email')) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP INDEX \`uk_users_email\``)
    } catch {}
  }
  if (await indexExists(knex, tbl, 'uk_users_username')) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP INDEX \`uk_users_username\``)
    } catch {}
  }

  // 回滚 nickname 列（若存在）
  const hasNickname = await columnExists(knex, tbl, 'nickname')
  if (hasNickname) {
    try {
      // MySQL 8+ / MariaDB: IF EXISTS
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP COLUMN IF EXISTS \`nickname\``)
    } catch {
      // 老版本不支持 IF EXISTS
      const stillHas = await columnExists(knex, tbl, 'nickname')
      if (stillHas) {
        await knex.schema.alterTable(tbl, t => {
          t.dropColumn('nickname')
        })
      }
    }
  }

  // 如需恢复旧索引名，可在此按需重建（通常不必）
}
