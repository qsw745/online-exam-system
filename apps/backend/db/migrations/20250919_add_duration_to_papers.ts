import type { Knex } from 'knex'

/**
 * 给 papers 表增加 duration 列
 * - 如果已存在则忽略
 * - 也可以根据需要同时补充 total_score、created_at、updated_at
 */
export async function up(knex: Knex): Promise<void> {
    // 检查是否存在 duration
    const hasDuration = await knex.schema.hasColumn('papers', 'duration')
    if (!hasDuration) {
        await knex.schema.alterTable('papers', table => {
            table.integer('duration').notNullable().defaultTo(60).after('total_score')
        })
    }

    // 可选：补充 total_score
    const hasTotalScore = await knex.schema.hasColumn('papers', 'total_score')
    if (!hasTotalScore) {
        await knex.schema.alterTable('papers', table => {
            table.integer('total_score').notNullable().defaultTo(100).after('difficulty')
        })
    }

    // 可选：补充 created_at / updated_at
    const hasCreatedAt = await knex.schema.hasColumn('papers', 'created_at')
    if (!hasCreatedAt) {
        await knex.schema.alterTable('papers', table => {
            table.dateTime('created_at').notNullable().defaultTo(knex.fn.now())
        })
    }

    const hasUpdatedAt = await knex.schema.hasColumn('papers', 'updated_at')
    if (!hasUpdatedAt) {
        await knex.schema.alterTable('papers', table => {
            table
                .dateTime('updated_at')
                .notNullable()
                .defaultTo(knex.fn.now())
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    // 回滚时删除 duration（一般不删除 total_score/时间戳，避免破坏其他逻辑）
    const hasDuration = await knex.schema.hasColumn('papers', 'duration')
    if (hasDuration) {
        await knex.schema.alterTable('papers', table => {
            table.dropColumn('duration')
        })
    }
}
