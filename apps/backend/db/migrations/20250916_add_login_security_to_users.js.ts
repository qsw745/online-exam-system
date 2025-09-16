// apps/backend/knex/migrations/20250916_add_login_security_to_users.js
/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    const hasTable = await knex.schema.hasTable('users')
    if (!hasTable) {
        throw new Error('users table does not exist')
    }

    const hasFailed = await knex.schema.hasColumn('users', 'failed_login_attempts')
    if (!hasFailed) {
        await knex.schema.alterTable('users', (t) => {
            t.integer('failed_login_attempts').notNullable().defaultTo(0).comment('连续登录失败次数')
        })
    }

    const hasLastFailed = await knex.schema.hasColumn('users', 'last_failed_at')
    if (!hasLastFailed) {
        await knex.schema.alterTable('users', (t) => {
            t.dateTime('last_failed_at').nullable().comment('最近一次登录失败时间')
        })
    }

    const hasLockedUntil = await knex.schema.hasColumn('users', 'locked_until')
    if (!hasLockedUntil) {
        await knex.schema.alterTable('users', (t) => {
            t.dateTime('locked_until').nullable().comment('账户锁定截止时间')
        })
    }

    // 可选：组合索引，按需添加
    // await knex.schema.alterTable('users', (t) => {
    //   t.index(['locked_until'])
    // })
}

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
    const hasTable = await knex.schema.hasTable('users')
    if (!hasTable) return

    await knex.schema.alterTable('users', (t) => {
        if (t.client.config.client.includes('mysql')) {
            // MySQL 需分别 drop 列
            t.dropColumn('failed_login_attempts')
            t.dropColumn('last_failed_at')
            t.dropColumn('locked_until')
        } else {
            t.dropColumns('failed_login_attempts', 'last_failed_at', 'locked_until')
        }
    })
}
