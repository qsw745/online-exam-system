// 20251119_fix_menus_view.ts
import type { Knex } from 'knex'

async function currentDb(knex: Knex): Promise<string> {
  const [rows] = await knex.raw<any[]>('SELECT DATABASE() AS db')
  return rows?.[0]?.db ?? rows?.[0]?.DB ?? rows?.[0]?.['DATABASE()'] ?? ''
}

async function isView(knex: Knex, name: string): Promise<boolean> {
  const db = await currentDb(knex)
  const [rows] = await knex.raw<any[]>(
    `SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_schema = ? AND table_name = ?`,
    [db, name]
  )
  return Number(rows?.[0]?.cnt ?? 0) > 0
}

export async function up(knex: Knex): Promise<void> {
  const hasSysMenus = await knex.schema.hasTable('sys_menus')
  if (!hasSysMenus) {
    throw new Error('sys_menus 不存在，无法重建 menus 视图')
  }

  const menusLooksLikeTable = (await knex.schema.hasTable('menus')) && !(await isView(knex, 'menus'))
  if (menusLooksLikeTable) {
    await knex.raw(`
      INSERT INTO sys_menus
        (id, parent_id, name, title, path, component, icon, sort_order, level,
         is_hidden, is_disabled, is_system, menu_type, permission_code, redirect, meta, created_at, updated_at)
      SELECT
        id, parent_id, name, title, path, component, icon, sort_order, level,
        is_hidden, is_disabled, is_system, menu_type, permission_code, redirect, meta, created_at, updated_at
      FROM menus
      ON DUPLICATE KEY UPDATE
        parent_id = VALUES(parent_id),
        name = VALUES(name),
        title = VALUES(title),
        path = VALUES(path),
        component = VALUES(component),
        icon = VALUES(icon),
        sort_order = VALUES(sort_order),
        level = VALUES(level),
        is_hidden = VALUES(is_hidden),
        is_disabled = VALUES(is_disabled),
        is_system = VALUES(is_system),
        menu_type = VALUES(menu_type),
        permission_code = VALUES(permission_code),
        redirect = VALUES(redirect),
        meta = VALUES(meta),
        updated_at = VALUES(updated_at)
    `)
    await knex.schema.dropTable('menus')
  }

  await knex.schema.raw(`
    DROP VIEW IF EXISTS \`menus\`;
  `)

  await knex.schema.raw(`
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
      level,
      is_hidden,
      is_disabled,
      is_system,
      menu_type,
      permission_code,
      redirect,
      meta,
      created_at,
      updated_at
    FROM \`sys_menus\`;
  `)
}

export async function down(knex: Knex): Promise<void> {
  // 回滚就简单一点，直接把视图删掉
  await knex.schema.raw(`
    DROP VIEW IF EXISTS \`menus\`;
  `)
}
