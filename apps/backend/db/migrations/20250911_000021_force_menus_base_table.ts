import type { Knex } from 'knex'

async function currentDb(knex: Knex): Promise<string> {
  const [rows] = await knex.raw<any[]>('SELECT DATABASE() AS db')
  return rows[0]?.db ?? rows[0]?.DB ?? rows[0]?.['DATABASE()'] ?? ''
}
async function isView(knex: Knex, name: string): Promise<boolean> {
  const db = await currentDb(knex)
  const [rows] = await knex.raw<any[]>(
    'SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_schema = ? AND table_name = ?',
    [db, name]
  )
  return Number(rows?.[0]?.cnt ?? 0) > 0
}

export async function up(knex: Knex): Promise<void> {
  // 无论如何，目标是：最后一定有“menus 基表”
  const menusIsView = await isView(knex, 'menus')
  if (menusIsView) {
    await knex.raw('DROP VIEW IF EXISTS `menus`')
  }

  const hasMenusTable = await knex.schema.hasTable('menus')
  if (!hasMenusTable) {
    // 用与 sys_menus 同步的结构创建 menus 基表（先不加 is_system/unit_id，让 20250912 来加）
    await knex.schema.createTable('menus', t => {
      t.increments('id').unsigned().primary()
      t.integer('parent_id').unsigned().nullable().index()
      t.string('name', 100).nullable().index()
      t.string('title', 200).nullable()
      t.string('path', 255).nullable()
      t.string('component', 255).nullable()
      t.string('icon', 100).nullable()
      t.integer('sort_order').nullable()
      t.boolean('is_hidden').notNullable().defaultTo(false)
      t.boolean('is_disabled').notNullable().defaultTo(false)
      t.enu('menu_type', ['page', 'menu', 'button', 'link']).nullable().defaultTo('page')
      t.string('permission_code', 100).nullable()
      t.string('redirect', 255).nullable()
      t.json('meta').nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
    })
  }

  // 如果 sys_menus 存在，就把数据灌一遍（存在则更新）；不存在也无妨，留空表等你后续 seed/迁移再填
  const hasSysMenus = await knex.schema.hasTable('sys_menus')
  if (hasSysMenus) {
    await knex.raw(`
      INSERT INTO menus
        (id, parent_id, name, title, path, component, icon, sort_order, is_hidden, is_disabled, menu_type, permission_code, redirect, meta, created_at, updated_at)
      SELECT
        id, parent_id, name, title, path, component, icon, sort_order, is_hidden, is_disabled, menu_type, permission_code, redirect, meta, created_at, updated_at
      FROM sys_menus
      ON DUPLICATE KEY UPDATE
        parent_id = VALUES(parent_id),
        name = VALUES(name),
        title = VALUES(title),
        path = VALUES(path),
        component = VALUES(component),
        icon = VALUES(icon),
        sort_order = VALUES(sort_order),
        is_hidden = VALUES(is_hidden),
        is_disabled = VALUES(is_disabled),
        menu_type = VALUES(menu_type),
        permission_code = VALUES(permission_code),
        redirect = VALUES(redirect),
        meta = VALUES(meta),
        created_at = VALUES(created_at),
        updated_at = VALUES(updated_at)
    `)
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚为视图（仅当需要）
  const hasMenusTable = await knex.schema.hasTable('menus')
  if (hasMenusTable) {
    await knex.schema.dropTable('menus')
  }
  const hasSysMenus = await knex.schema.hasTable('sys_menus')
  if (hasSysMenus) {
    await knex.raw(`
      CREATE VIEW \`menus\` AS
      SELECT
        id, parent_id, name, title, path, component, icon, sort_order,
        is_hidden, is_disabled, menu_type, permission_code, redirect, meta,
        created_at, updated_at
      FROM sys_menus
    `)
  }
}
