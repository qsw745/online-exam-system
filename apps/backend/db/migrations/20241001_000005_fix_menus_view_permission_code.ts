import type { Knex } from 'knex'

async function currentDb(knex: Knex): Promise<string> {
  const [rows] = await knex.raw<any[]>('SELECT DATABASE() AS db')
  return rows[0]?.db ?? rows[0]?.DB ?? rows[0]?.['DATABASE()'] ?? ''
}

async function viewHasColumn(knex: Knex, viewName: string, col: string): Promise<boolean> {
  const db = await currentDb(knex)
  const [rows] = await knex.raw<any[]>(
    'SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [db, viewName, col]
  )
  return Number(rows?.[0]?.cnt ?? 0) > 0
}

async function tableExists(knex: Knex, name: string): Promise<boolean> {
  return knex.schema.hasTable(name)
}

export async function up(knex: Knex): Promise<void> {
  // 前置：sys_menus 必须存在且有 permission_code
  if (!(await tableExists(knex, 'sys_menus'))) {
    throw new Error('sys_menus 不存在，无法修复 menus 视图；请先确保 baseline 创建了 sys_menus')
  }
  const hasPermCol = await knex.schema.hasColumn('sys_menus', 'permission_code')
  if (!hasPermCol) {
    // 兜底加列（通常 baseline 已经创建过了）
    await knex.schema.alterTable('sys_menus', t => {
      t.string('permission_code', 100).nullable()
    })
  }

  // 如果 menus 视图不存在，或存在但缺少 permission_code，就重建
  const hasPermInView = await viewHasColumn(knex, 'menus', 'permission_code')
  if (!hasPermInView) {
    await knex.raw('DROP VIEW IF EXISTS `menus`')
    await knex.raw(`
      CREATE VIEW \`menus\` AS
      SELECT
        id,
        parent_id,
        name,
        title,
        path,
        component,
        icon,
        sort_order,
        is_hidden,
        is_disabled,
        menu_type,
        permission_code,
        redirect,
        meta,
        created_at,
        updated_at
      FROM sys_menus
    `)
  }
}

export async function down(knex: Knex): Promise<void> {
  // 仅撤销我们创建/替换的视图，不动 sys_menus 的列
  await knex.raw('DROP VIEW IF EXISTS `menus`')
}
