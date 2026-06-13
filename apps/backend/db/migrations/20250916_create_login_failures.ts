import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const exists = await knex.schema.hasTable('login_failures')
    if (exists) return
    await knex.schema.createTable('login_failures', t => {
        t.increments('id').primary()
        t.string('email', 190).notNullable().index()
        t.string('ip', 64).notNullable().index()
        t.integer('fail_count').notNullable().defaultTo(0)
        t.dateTime('last_failed_at').notNullable().defaultTo(knex.fn.now())
        t.unique(['email', 'ip'])
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('login_failures')
}
