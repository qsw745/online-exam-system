// apps/backend/db/migrations/20251008_add_role_orgs.ts
import type { Knex } from 'knex'

/** 简易判断当前驱动 */
function client(knex: Knex) {
  return String((knex.client as any)?.config?.client || '')
}

/** 判断索引是否存在（MySQL/PG） */
async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const c = client(knex)
  try {
    if (c.includes('mysql')) {
      // MySQL: SHOW INDEX
      const res: any = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [table, indexName])
      const rows = Array.isArray(res) ? res[0] ?? res : res
      return Array.isArray(rows) && rows.length > 0
    }
    if (c.includes('pg')) {
      // PostgreSQL: pg_indexes
      const res: any = await knex.raw('SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1', [
        table,
        indexName,
      ])
      const rows = res?.rows ?? res?.[0]?.rows
      return Array.isArray(rows) && rows.length > 0
    }
  } catch {
    // 忽略探测失败，回退到 tryAddIndex 的 try/catch
  }
  return false
}

/** 安全添加索引（若已存在则跳过；添加失败也静默忽略） */
async function tryAddIndex(knex: Knex, table: string, columns: string[], name: string) {
  try {
    if (!(await hasIndex(knex, table, name))) {
      await knex.schema.alterTable(table, t => {
        t.index(columns, name)
      })
    }
  } catch {
    // 忽略“已存在”等错误，保持迁移幂等
  }
}

export async function up(knex: Knex): Promise<void> {
  // role_orgs：角色⇄机构 多对多
  const hasRoleOrgs = await knex.schema.hasTable('role_orgs')
  if (!hasRoleOrgs) {
    await knex.schema.createTable('role_orgs', t => {
      t.integer('role_id').unsigned().notNullable()
      t.integer('org_id').unsigned().notNullable()
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      t.primary(['role_id', 'org_id'])
      t.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE')
      t.foreign('org_id').references('id').inTable('organizations').onDelete('CASCADE')
      // 常用查询索引
      t.index(['org_id'], 'idx_role_orgs_org')
      t.index(['role_id'], 'idx_role_orgs_role')
    })
  }

  // —— 补全常用索引（若不存在则添加）——
  await tryAddIndex(knex, 'role_menus', ['role_id'], 'idx_role_menus_role')
  await tryAddIndex(knex, 'role_menus', ['menu_id'], 'idx_role_menus_menu')

  await tryAddIndex(knex, 'user_roles', ['user_id'], 'idx_user_roles_user')
  await tryAddIndex(knex, 'user_roles', ['role_id'], 'idx_user_roles_role')

  await tryAddIndex(knex, 'user_org_roles', ['user_id', 'org_id'], 'idx_uor_user_org')
  await tryAddIndex(knex, 'user_org_roles', ['role_id'], 'idx_uor_role')
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('role_orgs')
  if (has) {
    await knex.schema.dropTable('role_orgs')
  }
  // 索引一般无需回滚（不会影响旧代码），如需彻底回滚，可按需 dropIndex：
  // try { await knex.schema.alterTable('role_menus', t => t.dropIndex(['role_id'], 'idx_role_menus_role')) } catch {}
}
