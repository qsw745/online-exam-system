import type { Knex } from 'knex'

export const config = { transaction: false } // ✅ 关键：MySQL DDL 关闭事务

export async function up(knex: Knex): Promise<void> {
  const dbName = (knex.client as any).database?.() || (knex.client as any).config?.connection?.database

  // ---- helpers ----
  const hasTable = (t: string) => knex.schema.hasTable(t)
  const hasColumn = (t: string, c: string) => knex.schema.hasColumn(t, c)
  const safeRaw = async (sql: string) => {
    try {
      await knex.raw(sql)
    } catch {
      /* noop */
    }
  }

  // 1) roles：去掉 org_id，统一大小写无关唯一
  if (await hasColumn('roles', 'org_id')) {
    // a) 准备 role_orgs 表（先建，便于迁移 org_id → role_orgs）
    if (!(await hasTable('role_orgs'))) {
      await knex.schema.createTable('role_orgs', t => {
        t.integer('role_id').unsigned().notNullable()
        t.integer('org_id').unsigned().notNullable()
        t.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
        t.primary(['role_id', 'org_id'])
        t.foreign('role_id').references('roles.id').onDelete('CASCADE')
        t.foreign('org_id').references('organizations.id').onDelete('CASCADE')
        t.index(['org_id'], 'idx_role_orgs_org')
        t.index(['role_id'], 'idx_role_orgs_role')
      })
    }

    // b) 迁移老数据 roles.org_id → role_orgs
    await safeRaw(`
      INSERT IGNORE INTO role_orgs (role_id, org_id, created_at)
      SELECT id, org_id, NOW() FROM roles WHERE org_id IS NOT NULL
    `)

    // c) roles 删除和 org 相关索引
    for (const idx of [
      'uq_roles_org_name',
      'uq_roles_org_code',
      'uk_org_name',
      'uk_org_code',
      'idx_roles_org_id',
      'code',
      'uniq_roles_code',
    ]) {
      await safeRaw(`ALTER TABLE roles DROP INDEX ${idx}`)
    }

    // d) 删列 org_id
    await knex.schema.alterTable('roles', t => {
      t.dropColumn('org_id')
    })
  }

  // e) 生成列 + 忽略大小写唯一索引（全局唯一）
  const cols = await knex('INFORMATION_SCHEMA.COLUMNS')
    .select('COLUMN_NAME')
    .where({ TABLE_SCHEMA: dbName, TABLE_NAME: 'roles' })
  const colSet = new Set(cols.map((r: any) => r.COLUMN_NAME))
  if (!colSet.has('lower_name')) {
    await safeRaw(`ALTER TABLE roles ADD COLUMN lower_name VARCHAR(50) GENERATED ALWAYS AS (LOWER(name)) STORED`)
  }
  if (!colSet.has('lower_code')) {
    await safeRaw(`ALTER TABLE roles ADD COLUMN lower_code VARCHAR(50) GENERATED ALWAYS AS (LOWER(code)) STORED`)
  }
  await safeRaw(`CREATE UNIQUE INDEX uk_roles_lower_name ON roles(lower_name)`)
  await safeRaw(`CREATE UNIQUE INDEX uk_roles_lower_code ON roles(lower_code)`)

  // 2) permissions + role_permissions（替代 role_menus）
  if (!(await hasTable('permissions'))) {
    await knex.schema.createTable('permissions', t => {
      t.increments('id').unsigned().primary()
      t.string('code', 100).notNullable().unique()
      t.string('description', 255)
      t.timestamp('created_at').defaultTo(knex.fn.now())
      t.timestamp('updated_at').defaultTo(knex.fn.now())
    })
  }
  if (!(await hasTable('role_permissions'))) {
    await knex.schema.createTable('role_permissions', t => {
      t.integer('role_id').unsigned().notNullable()
      t.string('permission_code', 100).notNullable()
      t.primary(['role_id', 'permission_code'])
      t.foreign('role_id').references('roles.id').onDelete('CASCADE')
      t.foreign('permission_code').references('permissions.code').onDelete('CASCADE')
      t.index(['permission_code'], 'idx_roleperm_perm')
      t.index(['role_id'], 'idx_roleperm_role')
    })
  }

  // 从 menus.permission_code 预填充 permissions，并把 role_menus 的历史授权迁到 role_permissions
  if (await hasTable('menus')) {
    await safeRaw(`
      INSERT IGNORE INTO permissions(code, description, created_at, updated_at)
      SELECT DISTINCT m.permission_code, CONCAT('auto from menu: ', IFNULL(m.title, m.name)), NOW(), NOW()
      FROM menus m WHERE m.permission_code IS NOT NULL AND m.permission_code <> ''
    `)
    if (await hasTable('role_menus')) {
      await safeRaw(`
        INSERT IGNORE INTO role_permissions(role_id, permission_code)
        SELECT rm.role_id, m.permission_code
        FROM role_menus rm
        JOIN menus m ON m.id = rm.menu_id
        WHERE m.permission_code IS NOT NULL AND m.permission_code <> ''
      `)
    }
  }
  await safeRaw(`CREATE INDEX idx_menus_perm ON menus(permission_code)`)

  // 3) 视图：用户-机构-角色（沿用 user_org_roles）
  await safeRaw(`DROP VIEW v_user_roles`)
  await safeRaw(`
    CREATE VIEW v_user_roles AS
    SELECT
      uor.user_id,
      uor.org_id,
      r.id AS role_id,
      r.name AS role_name,
      r.code AS role_code,
      r.is_disabled,
      r.is_system,
      r.sort_order
    FROM user_org_roles uor
    JOIN roles r ON r.id = uor.role_id
  `)

  // 4) 清理：可选删除旧表
  const DROP_ROLE_MENUS = true
  const DROP_UNIT_MENUS = true
  const DROP_USER_MENUS = true
  if (DROP_ROLE_MENUS && (await hasTable('role_menus'))) await knex.schema.dropTable('role_menus')
  if (DROP_UNIT_MENUS && (await hasTable('unit_menus'))) await knex.schema.dropTable('unit_menus')
  if (DROP_USER_MENUS && (await hasTable('user_menus'))) await knex.schema.dropTable('user_menus')
}

export async function down(knex: Knex): Promise<void> {
  // 回滚视图
  try {
    await knex.raw(`DROP VIEW v_user_roles`)
  } catch {}

  // 最小回滚角色授权表
  if (await knex.schema.hasTable('role_permissions')) await knex.schema.dropTable('role_permissions')
  if (await knex.schema.hasTable('permissions')) await knex.schema.dropTable('permissions')

  // 回滚 roles 生成列与索引
  try {
    await knex.raw(`ALTER TABLE roles DROP INDEX uk_roles_lower_name`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE roles DROP INDEX uk_roles_lower_code`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE roles DROP COLUMN lower_name`)
  } catch {}
  try {
    await knex.raw(`ALTER TABLE roles DROP COLUMN lower_code`)
  } catch {}

  // 回补 org_id（仅用于彻底回滚）
  if (!(await knex.schema.hasColumn('roles', 'org_id'))) {
    await knex.schema.alterTable('roles', t => {
      t.integer('org_id').nullable()
    })
    try {
      await knex.raw(`CREATE INDEX idx_roles_org_id ON roles(org_id)`)
    } catch {}
    try {
      await knex.raw(`CREATE UNIQUE INDEX uq_roles_org_name ON roles(org_id, name)`)
    } catch {}
    try {
      await knex.raw(`CREATE UNIQUE INDEX uq_roles_org_code ON roles(org_id, code)`)
    } catch {}
  }

  // role_orgs 回滚
  if (await knex.schema.hasTable('role_orgs')) await knex.schema.dropTable('role_orgs')

  // 恢复 role_menus（空壳）
  if (!(await knex.schema.hasTable('role_menus'))) {
    await knex.schema.createTable('role_menus', t => {
      t.integer('role_id').unsigned().notNullable()
      t.integer('menu_id').notNullable()
      t.primary(['role_id', 'menu_id'])
      t.index(['role_id'], 'idx_role_menus_role')
      t.index(['menu_id'], 'idx_role_menus_menu')
      t.foreign('role_id').references('roles.id').onDelete('CASCADE')
      t.foreign('menu_id').references('menus.id').onDelete('CASCADE')
    })
  }
}
