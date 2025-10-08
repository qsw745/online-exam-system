import type { Knex } from 'knex'

/** 安全地判断列是否存在 */
async function hasColumn(knex: Knex, table: string, column: string) {
  return knex.schema.hasColumn(table, column)
}

/** 判断索引是否存在（MySQL） */
async function indexExists(knex: Knex, table: string, index: string) {
  const rows: any = await knex.raw(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [index])
  const list = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : rows
  return (list?.length ?? 0) > 0
}

/** 尝试删除索引（存在才删） */
async function dropIndexIfExists(knex: Knex, table: string, index: string) {
  if (await indexExists(knex, table, index)) {
    await knex.schema.raw(`ALTER TABLE \`${table}\` DROP INDEX \`${index}\``)
  }
}

/** 尝试删除外键（存在才删） */
async function dropFkIfExists(knex: Knex, table: string, fkName: string) {
  // INFORMATION_SCHEMA 里查约束名
  const rows: any = await knex.raw(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [table, fkName]
  )
  const list = Array.isArray(rows) ? (Array.isArray(rows[0]) ? rows[0] : rows) : rows
  if ((list?.length ?? 0) > 0) {
    await knex.schema.raw(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\``)
  }
}

/** 兼容解析 raw 返回值 */
function firstValue(ret: any) {
  const r = Array.isArray(ret) ? (Array.isArray(ret[0]) ? ret[0][0] : ret[0]) : ret
  return r
}

export async function up(knex: Knex): Promise<void> {
  // 1) 确保 roles.org_id 存在并建 FK / 普通索引
  const hasOrgId = await hasColumn(knex, 'roles', 'org_id')
  if (!hasOrgId) {
    await knex.schema.alterTable('roles', t => {
      t.integer('org_id').unsigned().nullable()
    })
  }

  // 外键（若 organizations 存在则加；已有则跳过）
  try {
    await knex.schema.raw(
      'ALTER TABLE `roles` ADD CONSTRAINT `fk_roles_org_id` FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL'
    )
  } catch {
    // 已存在或表不存在则忽略
  }

  // 普通索引（方便查询）
  if (!(await indexExists(knex, 'roles', 'idx_roles_org_id'))) {
    await knex.schema.raw('CREATE INDEX `idx_roles_org_id` ON `roles` (`org_id`)')
  }

  // 2) 删除旧的全局唯一索引
  await dropIndexIfExists(knex, 'roles', 'uk_name')
  await dropIndexIfExists(knex, 'roles', 'uk_code')

  // 3) 首选（MySQL 8+）：函数索引（COALESCE + LOWER）
  //    如果执行失败（如 MySQL 5.7），走降级方案（生成列 + 组合唯一索引）
  let functionalIndexOk = true
  try {
    await knex.schema.raw('CREATE UNIQUE INDEX `uk_org_name` ON `roles` ((COALESCE(org_id,0)), (LOWER(name)))')
    await knex.schema.raw('CREATE UNIQUE INDEX `uk_org_code` ON `roles` ((COALESCE(org_id,0)), (LOWER(code)))')
  } catch {
    functionalIndexOk = false
  }

  if (!functionalIndexOk) {
    // 4) 降级：生成列（5.7）
    const hasOrgIdNorm = await hasColumn(knex, 'roles', 'org_id_norm')
    if (!hasOrgIdNorm) {
      await knex.schema.raw(
        'ALTER TABLE `roles` ADD COLUMN `org_id_norm` INT GENERATED ALWAYS AS (IFNULL(`org_id`,0)) STORED'
      )
    }
    const hasNameLower = await hasColumn(knex, 'roles', 'name_lower')
    if (!hasNameLower) {
      await knex.schema.raw(
        'ALTER TABLE `roles` ADD COLUMN `name_lower` VARCHAR(255) GENERATED ALWAYS AS (LOWER(`name`)) STORED'
      )
    }
    const hasCodeLower = await hasColumn(knex, 'roles', 'code_lower')
    if (!hasCodeLower) {
      await knex.schema.raw(
        'ALTER TABLE `roles` ADD COLUMN `code_lower` VARCHAR(255) GENERATED ALWAYS AS (LOWER(`code`)) STORED'
      )
    }

    // 组合唯一索引
    if (!(await indexExists(knex, 'roles', 'uk_roles_org_name_lower'))) {
      await knex.schema.raw('CREATE UNIQUE INDEX `uk_roles_org_name_lower` ON `roles` (`org_id_norm`, `name_lower`)')
    }
    if (!(await indexExists(knex, 'roles', 'uk_roles_org_code_lower'))) {
      await knex.schema.raw('CREATE UNIQUE INDEX `uk_roles_org_code_lower` ON `roles` (`org_id_norm`, `code_lower`)')
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // 删除两种实现下可能存在的索引
  await dropIndexIfExists(knex, 'roles', 'uk_org_name')
  await dropIndexIfExists(knex, 'roles', 'uk_org_code')
  await dropIndexIfExists(knex, 'roles', 'uk_roles_org_name_lower')
  await dropIndexIfExists(knex, 'roles', 'uk_roles_org_code_lower')

  // 删除降级方案生成列（若存在）
  for (const col of ['org_id_norm', 'name_lower', 'code_lower']) {
    if (await hasColumn(knex, 'roles', col)) {
      await knex.schema.alterTable('roles', t => {
        // @ts-ignore
        t.dropColumn(col)
      })
    }
  }

  // 恢复旧的全局唯一索引
  if (!(await indexExists(knex, 'roles', 'uk_name'))) {
    await knex.schema.raw('CREATE UNIQUE INDEX `uk_name` ON `roles` (`name`)')
  }
  if (!(await indexExists(knex, 'roles', 'uk_code'))) {
    await knex.schema.raw('CREATE UNIQUE INDEX `uk_code` ON `roles` (`code`)')
  }

  // 可选：撤销 FK/普通索引（通常不必）
  // await dropFkIfExists(knex, 'roles', 'fk_roles_org_id')
  // await dropIndexIfExists(knex, 'roles', 'idx_roles_org_id')
}
