// apps/backend/migrations/20250917_fix_auth_login_failures_table.ts
import type { Knex } from 'knex'

const TABLE = 'auth_login_failures'

export async function up(knex: Knex): Promise<void> {
    const hasTable = await knex.schema.hasTable(TABLE)
    if (!hasTable) {
        await knex.schema.createTable(TABLE, (t) => {
            t.increments('id').primary()
            t.string('email', 255).notNullable()
            t.string('ip', 45).notNullable()
            t.integer('fail_count').notNullable().defaultTo(0)
            t.dateTime('last_failed_at').nullable()
            t.dateTime('locked_until').nullable()
            t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
            t.unique(['email', 'ip'], { indexName: 'uniq_auth_login_failures_email_ip' })
            t.index(['email'], 'idx_auth_login_failures_email')
            t.index(['locked_until'], 'idx_auth_login_failures_locked_until')
        })
        return
    }

    // 表已存在：逐列补齐
    const hasFailCount = await knex.schema.hasColumn(TABLE, 'fail_count')
    if (!hasFailCount) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.integer('fail_count').notNullable().defaultTo(0)
        })
    }

    const hasLastFailed = await knex.schema.hasColumn(TABLE, 'last_failed_at')
    if (!hasLastFailed) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.dateTime('last_failed_at').nullable()
        })
    }

    const hasLockedUntil = await knex.schema.hasColumn(TABLE, 'locked_until')
    if (!hasLockedUntil) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.dateTime('locked_until').nullable()
        })
    }

    const hasUpdatedAt = await knex.schema.hasColumn(TABLE, 'updated_at')
    if (!hasUpdatedAt) {
        await knex.schema.alterTable(TABLE, (t) => {
            t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
        })
    }

    // 索引/唯一键补齐
    // 唯一键
    const uniqRows = await knex.raw<any[]>(
        `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE='UNIQUE'`,
        [TABLE]
    )
    const hasUniq = (uniqRows[0] || []).some((r: any) => String(r.CONSTRAINT_NAME).includes('email_ip'))
    if (!hasUniq) {
        // 可能已存在重复行，先软清洗（保留最新）
        await knex.raw(`
      DELETE t1 FROM ${TABLE} t1
      JOIN ${TABLE} t2
        ON t1.email=t2.email AND t1.ip=t2.ip AND t1.id < t2.id;
    `)
        await knex.schema.alterTable(TABLE, (t) => {
            t.unique(['email', 'ip'], { indexName: 'uniq_auth_login_failures_email_ip' })
        })
    }

    // 索引
    const idxRows = await knex.raw<any[]>(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [TABLE]
    )
    const idxList = new Set((idxRows[0] || []).map((r: any) => r.INDEX_NAME))
    if (!idxList.has('idx_auth_login_failures_email')) {
        await knex.schema.alterTable(TABLE, (t) => t.index(['email'], 'idx_auth_login_failures_email'))
    }
    if (!idxList.has('idx_auth_login_failures_locked_until')) {
        await knex.schema.alterTable(TABLE, (t) => t.index(['locked_until'], 'idx_auth_login_failures_locked_until'))
    }
}

export async function down(knex: Knex): Promise<void> {
    // 保守回滚：不删表，避免丢生产数据。如果你需要销毁，请手动 drop。
    // await knex.schema.dropTableIfExists(TABLE)
}
