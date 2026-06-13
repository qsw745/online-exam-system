// apps/backend/db/migrations/20241001_000002_create_permissions_and_menu_view.ts
import type { Knex } from 'knex'

async function getCurrentDatabase(knex: Knex): Promise<string> {
  const [rows] = await knex.raw<any[]>('SELECT DATABASE() AS db')
  return rows[0]?.db ?? rows[0]?.DB ?? rows[0]?.['DATABASE()'] ?? ''
}

async function viewExists(knex: Knex, viewName: string): Promise<boolean> {
  const db = await getCurrentDatabase(knex)
  const [rows] = await knex.raw<any[]>(
    'SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_schema = ? AND table_name = ?',
    [db, viewName]
  )
  return Number(rows?.[0]?.cnt ?? 0) > 0
}

export async function up(knex: Knex): Promise<void> {
  // 1) permissions（供历史迁移 INSERT ... SELECT 使用）
  if (!(await knex.schema.hasTable('permissions'))) {
    await knex.schema.createTable('permissions', t => {
      t.increments('id').unsigned().primary()
      t.string('code', 150).notNullable().unique()
      t.string('description', 255).nullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())
      t.index(['code'], 'idx_permissions_code')
    })
  }

  // 2) role_permissions（⚠️ 历史迁移按“permission_code（字符串）”灌数据）
  if (!(await knex.schema.hasTable('role_permissions'))) {
    await knex.schema.createTable('role_permissions', t => {
      t.increments('id').unsigned().primary()
      t.integer('role_id').unsigned().notNullable()
      t.string('permission_code', 150).notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.unique(['role_id', 'permission_code'], { indexName: 'uk_role_permission_code' })
      t.index(['permission_code'], 'idx_role_permissions_code')
    })
  }

  // 3) 兼容视图：将 sys_menus 映射为 menus，满足历史迁移里对 `menus` 的引用
  const needView = !(await viewExists(knex, 'menus'))
  if (needView) {
    const hasSysMenus = await knex.schema.hasTable('sys_menus')
    if (!hasSysMenus) {
      throw new Error('sys_menus 不存在，无法创建视图 menus，请确认更早的 baseline 已创建 sys_menus')
    }
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
  await knex.raw('DROP VIEW IF EXISTS `menus`')
  if (await knex.schema.hasTable('role_permissions')) await knex.schema.dropTable('role_permissions')
  if (await knex.schema.hasTable('permissions')) await knex.schema.dropTable('permissions')
}
