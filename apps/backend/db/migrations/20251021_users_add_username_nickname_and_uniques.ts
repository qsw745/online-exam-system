import type { Knex } from 'knex'

async function tableExists(knex: Knex, table: string) {
  return knex.schema.hasTable(table)
}

async function columnExists(knex: Knex, table: string, column: string) {
  try {
    const [rows] = await knex.raw<any[]>(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column])
    return Array.isArray(rows) ? rows.length > 0 : (rows as any)?.length > 0
  } catch {
    return false
  }
}

async function indexExists(knex: Knex, table: string, indexName: string) {
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

  // 1) username 列
  if (!(await columnExists(knex, tbl, 'username'))) {
    try {
      await knex.raw(
        `ALTER TABLE \`${tbl}\` ADD COLUMN IF NOT EXISTS \`username\` varchar(64) NULL COMMENT '用于登录/展示的唯一用户名' AFTER \`id\``
      )
    } catch {
      if (!(await columnExists(knex, tbl, 'username'))) {
        await knex.schema.alterTable(tbl, t => {
          // @ts-ignore: MySQL 方言支持 after()
          t.string('username', 64).nullable().comment('用于登录/展示的唯一用户名').after?.('id')
        })
      }
    }
  }

  // 2) nickname 列
  if (!(await columnExists(knex, tbl, 'nickname'))) {
    try {
      await knex.raw(
        `ALTER TABLE \`${tbl}\` ADD COLUMN IF NOT EXISTS \`nickname\` varchar(64) NULL COMMENT '显示用昵称，可中文' AFTER \`username\``
      )
    } catch {
      if (!(await columnExists(knex, tbl, 'nickname'))) {
        await knex.schema.alterTable(tbl, t => {
          // @ts-ignore
          t.string('nickname', 64).nullable().comment('显示用昵称，可中文').after?.('username')
        })
      }
    }
  }

  // 3) 旧索引名清理（忽略失败）
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

  // 4) 回填 username（仅当列存在）
  if (await columnExists(knex, tbl, 'username')) {
    // 先把空/NULL 补上（email 前缀 + '-' + id，确保唯一）
    await knex.raw(`
      UPDATE \`${tbl}\`
         SET \`username\` = CONCAT(
               LEFT(SUBSTRING_INDEX(COALESCE(\`email\`, ''), '@', 1), 50),
               '-',
               \`id\`
             )
       WHERE \`username\` IS NULL OR \`username\` = ''
    `)
  }

  // 5) 创建统一的新唯一索引（若不存在）
  if (!(await indexExists(knex, tbl, 'uk_users_email'))) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` ADD UNIQUE INDEX \`uk_users_email\` (\`email\`)`)
    } catch {}
  }
  if (await columnExists(knex, tbl, 'username')) {
    if (!(await indexExists(knex, tbl, 'uk_users_username'))) {
      try {
        await knex.raw(`ALTER TABLE \`${tbl}\` ADD UNIQUE INDEX \`uk_users_username\` (\`username\`)`)
      } catch {}
    }
  }

  // 6) 建议：表字符集为 utf8mb4（失败忽略）
  try {
    await knex.raw(`ALTER TABLE \`${tbl}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`)
  } catch {}
}

export async function down(knex: Knex): Promise<void> {
  const tbl = 'users'
  if (!(await tableExists(knex, tbl))) return

  // 移除唯一索引（若存在）
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

  // 删除列（安全地）
  if (await columnExists(knex, tbl, 'nickname')) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP COLUMN IF EXISTS \`nickname\``)
    } catch {
      if (await columnExists(knex, tbl, 'nickname')) {
        await knex.schema.alterTable(tbl, t => t.dropColumn('nickname'))
      }
    }
  }
  if (await columnExists(knex, tbl, 'username')) {
    try {
      await knex.raw(`ALTER TABLE \`${tbl}\` DROP COLUMN IF EXISTS \`username\``)
    } catch {
      if (await columnExists(knex, tbl, 'username')) {
        await knex.schema.alterTable(tbl, t => t.dropColumn('username'))
      }
    }
  }
}
