import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasMenus = await knex.schema.hasTable('menus')
  if (!hasMenus) return

  const hasLevel = await knex.schema.hasColumn('menus', 'level')
  if (!hasLevel) {
    // 与 sys_menus 的类型保持一致：TINYINT UNSIGNED，可为空（历史数据不全时更安全）
    await knex.schema.alterTable('menus', t => {
      t.specificType('level', 'TINYINT UNSIGNED').nullable()
    })
  }

  // 从 sys_menus 回填一次（若存在）
  if (await knex.schema.hasTable('sys_menus')) {
    await knex.raw(`
      UPDATE menus m
      JOIN sys_menus s ON s.id = m.id
      SET m.level = COALESCE(m.level, s.level)
    `)
  }

  // 兜底默认值（仍为空的，置 1）
  await knex.raw(`UPDATE menus SET level = 1 WHERE level IS NULL`)
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('menus')) {
    if (await knex.schema.hasColumn('menus', 'level')) {
      await knex.schema.alterTable('menus', t => t.dropColumn('level'))
    }
  }
}

