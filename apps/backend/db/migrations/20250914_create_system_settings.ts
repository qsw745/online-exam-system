import type { Knex } from 'knex'

/**
 * 占位迁移：仅用于修复 “missing migration file” 错误。
 * 若该迁移已记录为已执行，Knex 只需要文件存在即可，不会再跑 up。
 */
export async function up(_knex: Knex): Promise<void> {
    // no-op
}

export async function down(_knex: Knex): Promise<void> {
    // no-op
}
