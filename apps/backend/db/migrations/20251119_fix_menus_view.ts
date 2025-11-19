// 20251119_fix_menus_view.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 先删掉旧的视图（如果存在）
  await knex.schema.raw(`
    DROP VIEW IF EXISTS \`menus\`;
  `)

  // 再创建新的视图定义
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
