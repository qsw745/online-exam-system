import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable('discussion_view_locks')
    if (!hasTable) {
        await knex.schema.createTable('discussion_view_locks', table => {
            table.integer('discussion_id').unsigned().notNullable()
            table.string('viewer_key', 191).notNullable()
            table.dateTime('expires_at').notNullable()
            table.primary(['discussion_id', 'viewer_key'])
            table.index(['expires_at'], 'idx_expires_at')
        })

        // 设置引擎/字符集（MySQL）
        await knex.raw(`ALTER TABLE discussion_view_locks ENGINE=InnoDB`)
        await knex.raw(`ALTER TABLE discussion_view_locks CONVERT TO CHARACTER SET utf8mb4`)
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('discussion_view_locks')
}
