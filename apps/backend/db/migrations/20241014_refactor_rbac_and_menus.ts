import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async trx => {
    // 1) roles 去掉 org_id + 统一唯一约束（忽略大小写）
    const hasOrgId = await trx.schema.hasColumn('roles', 'org_id')
    if (hasOrgId) {
      // 先删依赖索引（容错，不存在也忽略）
      const dropIdx = async (name: string) => {
        try {
          await trx.raw(`ALTER TABLE roles DROP INDEX ${name}`)
        } catch {}
      }
      await dropIdx('uq_roles_org_name')
      await dropIdx('uq_roles_org_code')
      await dropIdx('uk_org_name')
      await dropIdx('uk_org_code')
      await dropIdx('idx_roles_org_id')
      // 真正删列
      await trx.schema.alterTable('roles', t => {
        t.dropColumn('org_id')
      })
    }

    // 为忽略大小写唯一性，建生成列（lower_name/lower_code）
    const cols = await trx('INFORMATION_SCHEMA.COLUMNS')
      .select('COLUMN_NAME')
      .where({ TABLE_SCHEMA: trx.client.config.connection.database, TABLE_NAME: 'roles' })
    const colSet = new Set(cols.map((r: any) => r.COLUMN_NAME))
    if (!colSet.has('lower_name')) {
      await trx.raw(`ALTER TABLE roles
        ADD COLUMN lower_name VARCHAR(50) GENERATED ALWAYS AS (LOWER(name)) STORED,
        ADD COLUMN lower_code VARCHAR(50) GENERATED ALWAYS AS (LOWER(code)) STORED`)
      try {
        await trx.raw(`ALTER TABLE roles DROP INDEX code`)
      } catch {}
      try {
        await trx.raw(`ALTER TABLE roles DROP INDEX uniq_roles_code`)
      } catch {}
      await trx.raw(`CREATE UNIQUE INDEX uk_roles_lower_name ON roles(lower_name)`)
      await trx.raw(`CREATE UNIQUE INDEX uk_roles_lower_code ON roles(lower_code)`)
    }

    // 2) 新建 permissions & role_permissions
    const hasPerm = await trx.schema.hasTable('permissions')
    if (!hasPerm) {
      await trx.schema.createTable('permissions', t => {
        t.increments('id').unsigned().primary()
        t.string('code', 100).notNullable().unique()
        t.string('description', 255)
        t.timestamp('created_at').defaultTo(trx.fn.now())
        t.timestamp('updated_at').defaultTo(trx.fn.now())
      })
    }

    const hasRolePerm = await trx.schema.hasTable('role_permissions')
    if (!hasRolePerm) {
      await trx.schema.createTable('role_permissions', t => {
        t.integer('role_id').unsigned().notNullable()
        t.string('permission_code', 100).notNullable()
        t.primary(['role_id', 'permission_code'])
        t.foreign('role_id').references('roles.id').onDelete('CASCADE')
        // permission_code 直接引用 permissions.code（字符外键）
        t.foreign('permission_code').references('permissions.code').onDelete('CASCADE')
        t.index(['permission_code'], 'idx_roleperm_perm')
        t.index(['role_id'], 'idx_roleperm_role')
      })
    }

    // 3) 从 role_menus 迁移历史授权到 role_permissions（依赖 menus.permission_code）
    const hasRoleMenus = await trx.schema.hasTable('role_menus')
    if (hasRoleMenus) {
      // 先把 menus.permission_code 去重插入 permissions
      await trx.raw(`
        INSERT IGNORE INTO permissions(code, description, created_at, updated_at)
        SELECT DISTINCT m.permission_code, CONCAT('auto from menu: ', IFNULL(m.title, m.name)), NOW(), NOW()
        FROM menus m
        WHERE m.permission_code IS NOT NULL AND m.permission_code <> ''
      `)

      // 建立角色->权限映射（去重）
      await trx.raw(`
        INSERT IGNORE INTO role_permissions(role_id, permission_code)
        SELECT rm.role_id, m.permission_code
        FROM role_menus rm
        JOIN menus m ON m.id = rm.menu_id
        WHERE m.permission_code IS NOT NULL AND m.permission_code <> ''
      `)
    }

    // 4) 视图：把 user_org_roles 聚合为“用户-所有 org 的角色快照”（前端/后端查起来更直观）
    // 兼容 MySQL 8：先删再建
    try {
      await trx.raw(`DROP VIEW v_user_roles`)
    } catch {}
    await trx.raw(`
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

    // 5) 可选：删除表（如果你确认没用）
    //    - role_menus：已迁移为 role_permissions
    //    - unit_menus、user_menus：未使用则删；若仍需要“覆盖/例外”，建议保留并在业务上限制仅作覆盖用途
    const DROP_ROLE_MENUS = true
    const DROP_UNIT_MENUS = true // 若你还在用“单位菜单覆盖”，把它改为 false
    const DROP_USER_MENUS = true // 若你还在做“用户例外授权”，把它改为 false

    if (DROP_ROLE_MENUS && hasRoleMenus) {
      await trx.schema.dropTable('role_menus')
    }
    const hasUnitMenus = await trx.schema.hasTable('unit_menus')
    if (DROP_UNIT_MENUS && hasUnitMenus) {
      await trx.schema.dropTable('unit_menus')
    }
    const hasUserMenus = await trx.schema.hasTable('user_menus')
    if (DROP_USER_MENUS && hasUserMenus) {
      await trx.schema.dropTable('user_menus')
    }

    // 6) 索引优化（menus.permission_code 常用于过滤）
    try {
      await trx.raw(`CREATE INDEX idx_menus_perm ON menus(permission_code)`)
    } catch {}
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async trx => {
    // 回滚视图
    try {
      await trx.raw(`DROP VIEW v_user_roles`)
    } catch {}

    // 回滚删除的表（最小可用版）
    const hasRoleMenus = await trx.schema.hasTable('role_menus')
    if (!hasRoleMenus) {
      await trx.schema.createTable('role_menus', t => {
        t.integer('role_id').unsigned().notNullable()
        t.integer('menu_id').notNullable()
        t.primary(['role_id', 'menu_id'])
        t.index(['role_id'], 'idx_role_menus_role')
        t.index(['menu_id'], 'idx_role_menus_menu')
        t.foreign('role_id').references('roles.id').onDelete('CASCADE')
        t.foreign('menu_id').references('menus.id').onDelete('CASCADE')
      })
    }

    // 删 role_permissions / permissions
    const hasRolePerm = await trx.schema.hasTable('role_permissions')
    if (hasRolePerm) await trx.schema.dropTable('role_permissions')
    const hasPerm = await trx.schema.hasTable('permissions')
    if (hasPerm) await trx.schema.dropTable('permissions')

    // 回滚 roles 的生成列及索引
    try {
      await trx.raw(`ALTER TABLE roles DROP INDEX uk_roles_lower_name`)
    } catch {}
    try {
      await trx.raw(`ALTER TABLE roles DROP INDEX uk_roles_lower_code`)
    } catch {}
    const cols = await trx('INFORMATION_SCHEMA.COLUMNS')
      .select('COLUMN_NAME')
      .where({ TABLE_SCHEMA: trx.client.config.connection.database, TABLE_NAME: 'roles' })
    const colSet = new Set(cols.map((r: any) => r.COLUMN_NAME))
    if (colSet.has('lower_name')) {
      await trx.raw(`ALTER TABLE roles DROP COLUMN lower_name`)
    }
    if (colSet.has('lower_code')) {
      await trx.raw(`ALTER TABLE roles DROP COLUMN lower_code`)
    }

    // 回滚 roles.org_id（仅当需要）
    const hasOrgId = await trx.schema.hasColumn('roles', 'org_id')
    if (!hasOrgId) {
      await trx.schema.alterTable('roles', t => {
        t.integer('org_id').nullable()
      })
      try {
        await trx.raw(`CREATE INDEX idx_roles_org_id ON roles(org_id)`)
      } catch {}
      try {
        await trx.raw(`CREATE UNIQUE INDEX uq_roles_org_name ON roles(org_id, name)`)
      } catch {}
      try {
        await trx.raw(`CREATE UNIQUE INDEX uq_roles_org_code ON roles(org_id, code)`)
      } catch {}
    }
  })
}
// 让 Knex 不要为这个 migration 开事务（MySQL 的 DDL 本来就会隐式提交）
export const config = { transaction: false }
