import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('favorites'))) return
  if (await knex.schema.hasColumn('favorites', 'is_public')) return
  await knex.schema.alterTable('favorites', table => {
    // 旧收藏夹保持私有；公开状态由用户显式设置。
    table.boolean('is_public').notNullable().defaultTo(false)
  })
}

export async function down(): Promise<void> {
  // 兼容已有 is_public 的安装环境，回滚时保留列与用户的可见性设置。
}
