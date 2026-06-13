import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    const has = await knex.schema.hasTable('system_settings')
    if (!has) {
        await knex.schema.createTable('system_settings', (t) => {
            t.integer('id').primary()
            // MySQL 5.7+ 可用 JSON；为兼容性也可用 LONGTEXT 存储字符串化 JSON
            // 这里优先 JSON；如果你的 MySQL 版本较老，改成 t.text('data', 'longtext')
            // 并在仓库中照常 JSON.parse/JSON.stringify
            t.json('data').nullable()
            t.dateTime('updated_at').notNullable().defaultTo(knex.fn.now())
        })

        // 默认插入一条 id=1 的基础配置（含默认密码）
        await knex('system_settings').insert({
            id: 1,
            data: JSON.stringify({
                systemName: '在线考试系统',
                allowUserRegistration: true,
                maxLoginAttempts: 5,
                defaultPassword: '123456', // 默认密码（可在页面显示/修改）
            }),
            updated_at: knex.fn.now(),
        })
    }
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('system_settings')
}
