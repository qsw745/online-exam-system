import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const has = await knex.schema.hasTable('auth_login_failures')
    if (!has) {
        await knex.schema.createTable('auth_login_failures', t => {
            t.increments('id').primary()
            t.string('email', 255).notNullable()
            t.string('ip', 45).notNullable()
            t.integer('fail_count').notNullable().defaultTo(0)
            t.dateTime('locked_until').nullable()
            t.dateTime('last_failed_at').nullable()
            t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
            t.unique(['email', 'ip'], { indexName: 'uniq_email_ip' })
            t.index(['email'], 'idx_email')
            t.index(['locked_until'], 'idx_locked_until')
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('auth_login_failures')
}
