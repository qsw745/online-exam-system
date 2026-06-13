// migrations/20251021_fix_orgs_minimal.ts
import type { Knex } from 'knex'

const TBL = 'organizations'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TBL))) return

  // is_active
  if (!(await knex.schema.hasColumn(TBL, 'is_active'))) {
    await knex.schema.alterTable(TBL, t => {
      t.boolean('is_active').notNullable().defaultTo(true).comment('是否启用')
      t.index(['is_active'], 'idx_orgs_active')
    })
  }

  // created_at
  if (!(await knex.schema.hasColumn(TBL, 'created_at'))) {
    await knex.schema.alterTable(TBL, t => {
      t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    })
  }

  // updated_at
  if (!(await knex.schema.hasColumn(TBL, 'updated_at'))) {
    await knex.schema.alterTable(TBL, t => {
      t.timestamp('updated_at', { useTz: false }).notNullable().defaultTo(knex.fn.now())
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TBL))) return

  if (await knex.schema.hasColumn(TBL, 'is_active')) {
    await knex.schema.alterTable(TBL, t => {
      t.dropIndex(['is_active'], 'idx_orgs_active')
      t.dropColumn('is_active')
    })
  }
  // 通常不回滚时间戳，避免影响其它数据
}
