// migrations/20250917_fix_task_assignments_nulls.ts
import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const has = await knex.schema.hasTable('task_assignments')
    if (!has) return

    // 1) 清理历史 NULL
    await knex('task_assignments').whereNull('user_id').del()

    // 2) 调整列为 NOT NULL，并补索引
    const hasUserId = await knex.schema.hasColumn('task_assignments', 'user_id')
    if (hasUserId) {
        await knex.schema.alterTable('task_assignments', (t) => {
            t.integer('user_id').unsigned().notNullable().alter()
            t.index(['task_id', 'user_id'], 'idx_task_user')
        })
    }

    // 3) 可选：加外键（按你真实表名）
    try {
        await knex.schema.alterTable('task_assignments', (t) => {
            // 如果之前没有外键名字，可自定义名字避免重复
            t.foreign('task_id', 'fk_ta_task').references('tasks.id').onDelete('CASCADE')
            t.foreign('user_id', 'fk_ta_user').references('users.id').onDelete('CASCADE')
        })
    } catch {}
}

export async function down(knex: Knex): Promise<void> {
    const has = await knex.schema.hasTable('task_assignments')
    if (!has) return
    try {
        await knex.schema.alterTable('task_assignments', (t) => {
            t.dropForeign(['task_id'], 'fk_ta_task')
            t.dropForeign(['user_id'], 'fk_ta_user')
            t.dropIndex(['task_id', 'user_id'], 'idx_task_user')
            // 不把列改回可空，避免再出现脏数据
        })
    } catch {}
}
