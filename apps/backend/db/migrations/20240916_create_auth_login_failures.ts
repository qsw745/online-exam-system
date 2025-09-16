import type{ Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('auth_login_failures')
    if (!exists) {
        await knex.schema.createTable('auth_login_failures', t => {
            t.bigIncrements('id').primary()
            t.string('email', 191).notNullable().index()
            t.string('ip', 64).notNullable().index()
            t.integer('fail_count').notNullable().defaultTo(0)
            t.dateTime('last_failed_at').notNullable().defaultTo(knex.fn.now())
            t.unique(['email', 'ip'])
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('auth_login_failures')
}
