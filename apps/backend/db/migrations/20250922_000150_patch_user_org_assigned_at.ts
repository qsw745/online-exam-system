import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // user_org_roles.assigned_at
  if (await knex.schema.hasTable('user_org_roles')) {
    const has = await knex.schema.hasColumn('user_org_roles', 'assigned_at')
    if (!has) {
      await knex.schema.alterTable('user_org_roles', t => {
        t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now()).comment('分配时间')
      })
      // 兜底回填（保险起见；多数情况下新增 NOT NULL DEFAULT 会自动填充）
      await knex.raw(`UPDATE user_org_roles SET assigned_at = NOW() WHERE assigned_at IS NULL`)
    }

    // 建唯一约束（避免重复分配；已存在则忽略）
    try {
      await knex.schema.alterTable('user_org_roles', t => {
        t.unique(['user_id', 'org_id', 'role_id'], { indexName: 'uk_user_org_role' })
      })
    } catch {}
  }

  // user_organizations.assigned_at
  if (await knex.schema.hasTable('user_organizations')) {
    const has = await knex.schema.hasColumn('user_organizations', 'assigned_at')
    if (!has) {
      await knex.schema.alterTable('user_organizations', t => {
        t.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now()).comment('加入机构时间')
      })
      await knex.raw(`UPDATE user_organizations SET assigned_at = NOW() WHERE assigned_at IS NULL`)
    }

    // 唯一约束兜底
    try {
      await knex.schema.alterTable('user_organizations', t => {
        t.unique(['user_id', 'org_id'], { indexName: 'uk_user_org' })
      })
    } catch {}
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('user_org_roles')) {
    try {
      await knex.schema.alterTable('user_org_roles', t => {
        try {
          t.dropUnique(['user_id', 'org_id', 'role_id'], 'uk_user_org_role')
        } catch {}
        t.dropColumn('assigned_at')
      })
    } catch {}
  }
  if (await knex.schema.hasTable('user_organizations')) {
    try {
      await knex.schema.alterTable('user_organizations', t => {
        try {
          t.dropUnique(['user_id', 'org_id'], 'uk_user_org')
        } catch {}
        t.dropColumn('assigned_at')
      })
    } catch {}
  }
}
